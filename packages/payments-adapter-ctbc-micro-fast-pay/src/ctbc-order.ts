import {
  PaymentEvents,
  Order,
  OrderState,
  OrderFailMessage,
  PaymentItem,
  AdditionalInfo,
  AsyncOrderInformation,
} from '@rytass/payments';
import { encodeRequestPayload, toTxnPayload } from './ctbc-crypto';
import { CTBCPayment } from './ctbc-payment';
import { decodeResponsePayload, validateResponseMAC } from './ctbc-response';
import {
  CTBCOrderCommitMessage,
  CTBCOrderCommitPayload,
  CTBCOrderCommitResult,
  CTBCOrderCommitResultPayload,
  CTBCOrderInput,
} from './typings';

export class CTBCOrder implements Order<CTBCOrderCommitMessage> {
  private readonly _gateway: CTBCPayment;

  id: string;
  items: PaymentItem[] = [];
  state: OrderState = OrderState.INITED;
  createdAt: Date = new Date();
  committedAt: Date | null = null;
  additionalInfo?: AdditionalInfo<CTBCOrderCommitMessage>;
  asyncInfo?: AsyncOrderInformation<CTBCOrderCommitMessage>;
  failedMessage: OrderFailMessage | null = null;

  private _amount: number;
  private _memberId: string;
  private _cardToken: string;
  private _platformTradeNumber?: string;

  constructor(input: CTBCOrderInput, gateway: CTBCPayment) {
    this.id = input.id;
    this._amount = input.totalPrice;
    this._memberId = input.memberId;
    this._cardToken = input.cardToken;
    this._gateway = gateway;
  }

  get amount(): number {
    return this._amount;
  }

  get memberId(): string {
    return this._memberId;
  }

  get cardToken(): string {
    return this._cardToken;
  }

  get platformTradeNumber(): string | undefined {
    return this._platformTradeNumber;
  }

  get committable(): boolean {
    return this.state === OrderState.INITED && !this.failedMessage;
  }

  infoRetrieved(info: AsyncOrderInformation<CTBCOrderCommitMessage>): void {
    this.asyncInfo = info;
  }

  fail(code: string, message: string): void {
    this.failedMessage = { code, message };
    this.state = OrderState.FAILED;
  }

  commit(
    message: CTBCOrderCommitMessage,
    info?: AdditionalInfo<CTBCOrderCommitMessage>,
  ): void {
    this.committedAt = message.committedAt;
    this.state = OrderState.COMMITTED;
    this.additionalInfo = info;
  }

  async refund(): Promise<void> {
    throw new Error('CTBCOrder.refund not implemented');
  }

  async executeCommit(): Promise<CTBCOrderCommitResult> {
    const payload: CTBCOrderCommitPayload = {
      MerID: this._gateway.merchantId,
      MemberID: this._memberId,
      RequestNo: this.id,
      Token: this._cardToken,
      PurchAmt: this._amount,
    };

    const encodedRequestPayload = encodeRequestPayload(
      'PayJSON',
      toTxnPayload(payload),
      this._gateway,
    );

    const response = await fetch(this._gateway.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        reqjsonpwd: encodedRequestPayload,
      }).toString(),
    });

    if (!response.ok) {
      const message = `HTTP Error ${response.status}`;

      this.fail(`${response.status}`, message);
      this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);

      return {
        success: false,
        error: {
          code: `${response.status}`,
          message,
        },
      };
    }

    const responseText = await response.text();

    const parsed = decodeResponsePayload(responseText, this._gateway.txnKey);

    const result: CTBCOrderCommitResultPayload = {
      MerchantID: parsed.MerchantID,
      MerID: parsed.MerID,
      MemberID: parsed.MemberID,
      RequestNo: parsed.RequestNo,
      StatusCode: parsed.StatusCode,
      StatusDesc: parsed.StatusDesc,
      ResponseTime: parsed.ResponseTime,
      AuthCode: parsed.AuthCode ?? undefined,
      ECI: parsed.ECI ?? undefined,
      OrderNo: parsed.OrderNo ?? undefined,
    };

    if (
      !validateResponseMAC(
        parsed as Record<string, string>,
        this._gateway.txnKey,
      )
    ) {
      this.fail('MAC_FAIL', 'Invalid MAC in response');
      this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);

      return {
        success: false,
        error: {
          code: 'MAC_FAIL',
          message: 'Invalid MAC in response',
        },
      };
    }

    if (result.StatusCode === '00') {
      this._platformTradeNumber = result.OrderNo;
      this.commit({
        id: this.id,
        totalPrice: this._amount,
        memberId: this._memberId,
        cardToken: this._cardToken,
        committedAt: new Date(),
      });

      this._gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);

      return {
        success: true,
        orderNo: result.OrderNo,
      };
    } else {
      this.fail(result.StatusCode, result.StatusDesc);
      this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);

      return {
        success: false,
        error: {
          code: result.StatusCode,
          message: result.StatusDesc,
        },
      };
    }
  }
}
