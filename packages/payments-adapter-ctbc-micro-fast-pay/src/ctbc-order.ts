import { PaymentEvents } from '@rytass/payments';
import { buildReqjsonpwd, toTxnPayload } from './ctbc-crypto';
import { parseRspjsonpwd, validateRspjsonpwdMAC } from './ctbc-response';
import {
  CTBCOrderCommitPayload,
  CTBCOrderCommitResult,
  CTBCOrderCommitResultPayload,
  CTBCOrderState,
} from './typings';
import { CTBCPayment } from './ctbc-payment';

export class CTBCOrder {
  private readonly _gateway: CTBCPayment;

  private _id: string;
  private _amount: number;
  private _memberId: string;
  private _cardToken: string;

  private _createdAt: Date;
  private _committedAt?: Date;
  private _platformTradeNumber?: string;

  private _failedCode?: string;
  private _failedMessage?: string;

  constructor(
    id: string,
    amount: number,
    memberId: string,
    cardToken: string,
    gateway: CTBCPayment,
  ) {
    this._id = id;
    this._amount = amount;
    this._memberId = memberId;
    this._cardToken = cardToken;
    this._gateway = gateway;

    this._createdAt = new Date();
  }

  get id(): string {
    return this._id;
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

  get createdAt(): Date {
    return this._createdAt;
  }

  get committedAt(): Date | undefined {
    return this._committedAt;
  }

  get platformTradeNumber(): string | undefined {
    return this._platformTradeNumber;
  }

  get failedMessage(): { code: string; message: string } | null {
    if (!this._failedCode) return null;

    return {
      code: this._failedCode,
      message: this._failedMessage!,
    };
  }

  get committable(): boolean {
    return !this._committedAt && !this._failedCode;
  }

  get state(): CTBCOrderState {
    if (this._failedCode) return CTBCOrderState.FAILED;
    if (this._committedAt) return CTBCOrderState.COMMITTED;

    return CTBCOrderState.INITED;
  }

  async commit(): Promise<CTBCOrderCommitResult> {
    const payload: CTBCOrderCommitPayload = {
      MerID: this._gateway.merchantId,
      MemberID: this._memberId,
      RequestNo: this._id,
      Token: this._cardToken,
      PurchAmt: this._amount,
    };

    const reqjsonpwd = buildReqjsonpwd(
      'PayJSON',
      toTxnPayload(payload),
      this._gateway,
    );

    const response = await fetch(this._gateway.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ reqjsonpwd }).toString(),
    });

    if (!response.ok) {
      const message = `HTTP Error ${response.status}`;

      this.markFailed(`${response.status}`, message);
      this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);

      return {
        success: false,
        error: {
          code: `${response.status}`,
          message,
        },
      };
    }

    const rspText = await response.text();

    const parsed = parseRspjsonpwd(rspText, this._gateway.txnKey);

    if (
      !validateRspjsonpwdMAC(
        parsed as unknown as Record<string, string>,
        this._gateway.txnKey,
      )
    ) {
      this.markFailed('MAC_FAIL', 'Invalid MAC in response');
      this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);

      return {
        success: false,
        error: {
          code: 'MAC_FAIL',
          message: 'Invalid MAC in response',
        },
      };
    }

    const result = parsed as unknown as CTBCOrderCommitResultPayload;

    if (result.StatusCode === '00') {
      this.markCommitted(result.OrderNo);
      this._gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);

      return {
        success: true,
        orderNo: result.OrderNo,
      };
    } else {
      this.markFailed(result.StatusCode, result.StatusDesc);
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

  private markCommitted(orderNo?: string) {
    this._committedAt = new Date();
    this._platformTradeNumber = orderNo;
  }

  private markFailed(code: string, message: string) {
    this._failedCode = code;
    this._failedMessage = message;
  }
}
