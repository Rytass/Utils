/**
 * NewebPayOrder (Pn)
 * --------------------------------------------------
 * Encapsulates the NPA-B102 "Subsequent Scheduled Payment" flow.
 *
 * Flow:
 *   1. Gateway.createOrder(...) → new NewebPayOrder
 *   2. Client calls order.executeCommit()
 *   3. This file constructs PostData_ (AES/CBC + SHA256) and sends it to /API/CreditCard
 *   4. Parses response, verifies hash, updates state, and emits related events
 */

import { Order, OrderState, PaymentEvents } from '@rytass/payments';
import { encodePayload } from './newebpay-crypto';
import { NewebPayPayment } from './newebpay-payment';
import { decodeEncryptData } from './newebpay-response';

import {
  AdditionalInfo,
  AsyncOrderInformation,
  OrderFailMessage,
  PaymentItem,
} from '@rytass/payments';
import {
  NewebPayOrderCommitMessage,
  NewebPayOrderCommitResult,
  NewebPayOrderInput,
  PnEncryptData,
} from './typings';

export class NewebPayOrder implements Order<NewebPayOrderCommitMessage> {
  readonly id: string;
  readonly createdAt: Date = new Date();
  committedAt: Date | null = null;
  state: OrderState = OrderState.INITED;

  /** T / V */
  private readonly tokenTerm: string;
  private readonly tokenValue: string;

  private readonly amount: number;
  private readonly description?: string;

  private readonly _gateway: NewebPayPayment;

  items: PaymentItem[] = [];
  additionalInfo?: AdditionalInfo<NewebPayOrderCommitMessage>;
  asyncInfo?: AsyncOrderInformation<NewebPayOrderCommitMessage>;
  failedMessage: OrderFailMessage | null = null;

  constructor(input: NewebPayOrderInput, gateway: NewebPayPayment) {
    this.id = input.id;
    this.tokenTerm = input.tokenTerm;
    this.tokenValue = input.tokenValue;
    this.amount = input.amount;
    this.description = input.description;
    this._gateway = gateway;
  }

  get committable(): boolean {
    return this.state === OrderState.INITED && !this.failedMessage;
  }

  infoRetrieved(info: AsyncOrderInformation<NewebPayOrderCommitMessage>): void {
    this.asyncInfo = info;
    this.state = OrderState.ASYNC_INFO_RETRIEVED;
    this._gateway.emitter.emit(PaymentEvents.ORDER_INFO_RETRIEVED, this);
  }

  fail(code: string, message: string): void {
    this.failedMessage = { code, message };
    this.state = OrderState.FAILED;
  }

  commit(
    message: NewebPayOrderCommitMessage,
    addInfo?: AdditionalInfo<NewebPayOrderCommitMessage>,
  ): void {
    this.committedAt = message.committedAt;
    this.state = OrderState.COMMITTED;
    this.additionalInfo = addInfo;
  }

  async refund(): Promise<void> {
    throw new Error('Refund not implemented for NewebPayOrder');
  }

  /* ------------------------------------------------------------------ */
  /* Execute commit (send Pn)                                           */
  /* ------------------------------------------------------------------ */

  async executeCommit(): Promise<NewebPayOrderCommitResult> {
    if (this.state !== OrderState.INITED)
      throw new Error('Order already committed');

    // Build payload for AES encode (PostData_)
    const payload = {
      MerchantID: this._gateway.merchantId,
      TimeStamp: Math.floor(Date.now() / 1000),
      Version: '2.1',
      Amt: this.amount,
      TokenTerm: this.tokenTerm,
      TokenValue: this.tokenValue,
      MerchantOrderNo: this.id,
    };

    const { encrypted: EncryptData, hash: HashData } = encodePayload(
      payload,
      this._gateway.encodeOpts,
    );

    // Form fields for /API/CreditCard
    const resp = await this._gateway['postForm']<{
      EncryptData: string;
      HashData: string;
    }>('/API/CreditCard', {
      MerchantID_: this._gateway.merchantId,
      PostData_: EncryptData,
      Pos_: 'JSON',
    });

    let result: NewebPayOrderCommitResult;

    try {
      const data = decodeEncryptData(
        resp,
        this._gateway.encodeOpts,
      ) as unknown as PnEncryptData;

      if (data.Status === 'SUCCESS') {
        this.state = OrderState.COMMITTED;
        this.committedAt = new Date(data.PayTime.replace(/-/g, '/'));
        result = {
          success: true,
          tradeNo: data.TradeNo,
          payTime: data.PayTime,
        };

        this._gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);
      } else {
        this.state = OrderState.FAILED;
        result = {
          success: false,
          error: { code: data.Status, message: data.Message },
        };

        this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);
      }
    } catch (err: any) {
      this.state = OrderState.FAILED;
      result = {
        success: false,
        error: { code: 'DECODE_FAIL', message: err.message },
      };

      this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);
    }

    return result;
  }
}
