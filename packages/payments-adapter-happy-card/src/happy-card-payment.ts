import { PaymentGateway } from '@rytass/payments';
import { EventEmitter } from 'events';
import { createHash, randomBytes } from 'crypto';
import { HappyCardOrder } from './happy-card-order';
import {
  HappyCardAPIBaseData,
  HappyCardBaseUrls,
  HappyCardCommitMessage,
  HappyCardCommitOptions,
  HappyCardPaymentInitOptions,
  HappyCardPayOptions,
  HappyCardPayRequest,
  HappyCardPayResponse,
  HappyCardRecord,
  HappyCardRecordType,
  HappyCardRefundOptions,
  HappyCardRefundRequest,
  HappyCardRefundResponse,
  HappyCardResultCode,
  HappyCardSearchCardRequest,
  HappyCardSearchCardResponse,
} from './typings';
import { DateTime } from 'luxon';
import axios from 'axios';

export class HappyCardPayment<
  CM extends HappyCardCommitMessage = HappyCardCommitMessage,
> implements PaymentGateway<CM, HappyCardOrder<CM>>
{
  private readonly STORE_ID = '999999';
  private readonly VERSION = '001';
  private readonly POS_ID = '01';
  private readonly VALID_PRODUCT_TYPE_SET = new Set(['1', '3']);
  private readonly cSource: string;
  private readonly key: string;

  readonly baseUrl: HappyCardBaseUrls;
  readonly emitter = new EventEmitter();

  getBaseData(isIsland = false): HappyCardAPIBaseData {
    const now = DateTime.now();

    return {
      check: createHash('md5')
        .update(
          `${this.key}?${this.cSource}?${this.STORE_ID}?${now.toFormat('yyyyMMdd')}`,
        )
        .digest('hex')
        .toUpperCase(),
      source: this.cSource,
      version: this.VERSION,
      store_id: this.STORE_ID,
      pos_id: this.POS_ID,
      createdate: now.toISO(),
      area: isIsland ? 2 : 1,
    };
  }

  private getOrderId() {
    return randomBytes(10).toString('hex');
  }

  constructor(options: HappyCardPaymentInitOptions) {
    this.baseUrl = options.baseUrl ?? HappyCardBaseUrls.DEVELOPMENT;
    this.cSource = options.cSource;
    this.key = options.key;
  }

  async prepare<P_OCM extends CM>(
    options: HappyCardPayOptions,
  ): Promise<HappyCardOrder<P_OCM>> {
    const now = DateTime.now();

    const totalItemPrice = options.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    const totalUseAmount = options.useRecords.reduce(
      (sum, record) => sum + record.amount,
      0,
    );

    if (totalItemPrice !== totalUseAmount) {
      throw new Error('Total item price does not match with total use amount');
    }

    const orderId = options.id || this.getOrderId();

    const records = await this.getCardBalance(options.cardSerial, true);

    const recordBalanceMap = new Map(
      records.map((record) => [`${record.id}:${record.type}`, record.amount]),
    );

    if (
      options.useRecords.some((record) => {
        const balanceRecord = recordBalanceMap.get(
          `${record.id}:${record.type ?? HappyCardRecordType.AMOUNT}`,
        );

        if (!balanceRecord) return true;

        return balanceRecord < record.amount;
      })
    ) {
      throw new Error('Balance is not enough');
    }

    if (options.posTradeNo && options.posTradeNo.length > 6) {
      throw new Error('POS Trade No length should be less than 6');
    }

    return new HappyCardOrder({
      id: orderId,
      posTradeNo: options.posTradeNo,
      items: options.items,
      gateway: this,
      createdAt: now.toJSDate(),
      isIsland: options.isIsland,
      payload: {
        request_no: orderId,
        trade_date: now.toISO(),
        is_own_cup: 0,
        cup_count: 0,
        pos_trade_no: options.posTradeNo ?? '',
        MemberGid: options.uniMemberGID ?? '',
        card_list: [
          {
            card_sn: options.cardSerial,
            record_list: [],
            use_list: records.map((record) => ({
              record_id: record.id,
              type: record.type ?? HappyCardRecordType.AMOUNT,
              amt: record.amount,
              tax_type: options.isIsland ? '116' : '117',
            })),
          },
        ],
      },
    });
  }

  query<O extends HappyCardOrder<CM>>(id: string): Promise<O> {
    throw new Error('Method not implemented.');
  }

  async commit(options: HappyCardCommitOptions): Promise<void> {
    const payload: HappyCardPayRequest = {
      basedata: this.getBaseData(options.isIsland),
      ...options.payload,
    };

    const { data } = await axios.post<HappyCardPayResponse>(
      `${this.baseUrl}/Pay`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.resultCode !== HappyCardResultCode.SUCCESS) {
      throw new Error(`[${data.resultCode}] ${data.resultMsg}`);
    }
  }

  async refund(options: HappyCardRefundOptions): Promise<void> {
    const { data } = await axios.post<HappyCardRefundResponse>(
      `${this.baseUrl}/CancelPay`,
      JSON.stringify({
        basedata: this.getBaseData(options.isIsland),
        type: 2,
        card_list: [
          {
            request_no: options.id,
            pos_trade_no: options.posTradeNo ?? '',
            card_sn: options.cardSerial,
          },
        ],
      } as HappyCardRefundRequest),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.resultCode !== HappyCardResultCode.SUCCESS) {
      throw new Error(`[${data.resultCode}] ${data.resultMsg}`);
    }
  }

  async getCardBalance(
    cardSerial: string,
    returnRecords: false,
    isIsland?: boolean,
  ): Promise<number>;
  async getCardBalance(
    cardSerial: string,
    returnRecords: true,
    isIsland?: boolean,
  ): Promise<HappyCardRecord[]>;
  async getCardBalance(
    cardSerial: string,
    returnRecords = false,
    isIsland: boolean = false,
  ): Promise<number | HappyCardRecord[]> {
    const { data } = await axios.post<HappyCardSearchCardResponse>(
      `${this.baseUrl}/SearchCard`,
      JSON.stringify({
        basedata: this.getBaseData(isIsland),
        card_sn: cardSerial,
      } as HappyCardSearchCardRequest),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.resultCode !== HappyCardResultCode.SUCCESS) {
      throw new Error(data.resultMsg);
    }

    if (returnRecords) {
      return data.data.card_list
        .filter((card) => this.VALID_PRODUCT_TYPE_SET.has(card.productType))
        .map((card) =>
          card.record_list.map((record) => ({
            id: record.record_id,
            type: record.type,
            amount: record.amt,
          })),
        )
        .flat();
    }

    return data.data.card_list
      .filter((card) => this.VALID_PRODUCT_TYPE_SET.has(card.productType))
      .reduce((sum, card) => sum + card.amt, 0);
  }
}
