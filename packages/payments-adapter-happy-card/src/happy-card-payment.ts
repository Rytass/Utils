import { PaymentGateway } from '@rytass/payments';
import { EventEmitter } from 'events';
import { createHash, randomBytes } from 'crypto';
import { HappyCardOrder } from './happy-card-order';
import {
  HappyCardAPIBaseData,
  HappyCardBaseUrls,
  HappyCardCommitMessage,
  HappyCardPaymentInitOptions,
  HappyCardPayOptions,
  HappyCardPayRequest,
  HappyCardPayResponse,
  HappyCardRecordType,
  HappyCardResultCode,
  HappyCardSearchCardRequest,
  HappyCardSearchCardResponse,
} from './typings';
import { DateTime } from 'luxon';
import axios from 'axios';
import { BadRequestException } from '@nestjs/common';
import { groupBy } from 'lodash';

export class HappyCardPayment<
  CM extends HappyCardCommitMessage = HappyCardCommitMessage,
> implements PaymentGateway<CM, HappyCardOrder<CM>>
{
  private readonly STORE_ID = '999999';
  private readonly VERSION = '001';
  private readonly POS_ID = '01';
  private readonly VALID_PRODUCT_TYPE_SET = new Set(['1', '3']);

  private baseUrl = HappyCardBaseUrls.DEVELOPMENT;
  private cSource: string;
  private key: string;

  readonly emitter = new EventEmitter();

  private getBaseData(isIsland = false): HappyCardAPIBaseData {
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
      area: isIsland ? '2' : '1',
    };
  }

  private getOrderId() {
    return randomBytes(10).toString('hex');
  }

  constructor(options: HappyCardPaymentInitOptions) {
    this.baseUrl = options.baseUrl ?? this.baseUrl;
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
      throw new BadRequestException(
        'Total item price does not match with total use amount',
      );
    }

    const orderId = options.id || this.getOrderId();

    const payload: HappyCardPayRequest = {
      basedata: this.getBaseData(options.isIsland),
      request_no: orderId,
      trade_date: now.toISO(),
      is_own_cup: 0,
      cup_count: 0,
      MemberGid: options.uniMemberGID ?? undefined,
      card_list: Object.values(
        groupBy(options.useRecords, (record) => record.cardSerial),
      ).map((records) => ({
        card_sn: records[0].cardSerial,
        record_list: [],
        use_list: records.map((record) => ({
          record_id: record.id,
          type: record.type ?? HappyCardRecordType.AMOUNT,
          amt: record.amount,
          tax_type: options.isIsland ? '116' : '117',
        })),
      })),
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
      return new HappyCardOrder({
        id: orderId,
        items: options.items,
        gateway: this,
        createdAt: now.toJSDate(),
        committedAt: null,
        failedCode: data.resultCode,
        failedMessage: data.resultMsg,
      });
    }

    return new HappyCardOrder({
      id: orderId,
      items: options.items,
      gateway: this,
      createdAt: now.toJSDate(),
      committedAt: now.toJSDate(),
    });
  }

  query<O extends HappyCardOrder<CM>>(id: string): Promise<O> {
    throw new Error('Method not implemented.');
  }

  async getCardBalance(cardSerial: string): Promise<number> {
    const { data } = await axios.post<HappyCardSearchCardResponse>(
      `${this.baseUrl}/SearchCard`,
      JSON.stringify({
        basedata: this.getBaseData(),
        card_sn: cardSerial,
      } as HappyCardSearchCardRequest),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.resultCode !== HappyCardResultCode.SUCCESS) {
      throw new BadRequestException(data.resultMsg);
    }

    return data.data.card_list.reduce((sum, card) => sum + card.amt, 0);
  }
}
