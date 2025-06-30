import { PaymentEvents } from '@rytass/payments';
import { DateTime } from 'luxon';
import { encodeRequestPayload, toTxnPayload } from './ctbc-crypto';
import { CTBCPayment } from './ctbc-payment';
import {
  CTBCBindCardCallbackPayload,
  CTBCBindCardRequestPayload,
  CTBCBindCardRequestState,
} from './typings';

export class CTBCBindCardRequest {
  private readonly _gateway: CTBCPayment;
  private readonly _payload: CTBCBindCardRequestPayload;

  private _resolved = false;

  private _memberId: string;
  private _cardId?: string;
  private _cardNumberPrefix?: string;
  private _cardNumberSuffix?: string;
  private _bindingDate?: Date;
  private _failedCode?: string;
  private _failedMessage?: string;

  constructor(payload: CTBCBindCardRequestPayload, gateway: CTBCPayment) {
    this._payload = payload;
    this._gateway = gateway;
    this._memberId = payload.MemberID;
  }

  get memberId(): string {
    return this._memberId;
  }

  get form(): Record<string, string> {
    if (this._resolved) throw new Error('Form already used');
    this._resolved = true;

    return {
      reqjsonpwd: encodeRequestPayload(
        'TokenAdd',
        toTxnPayload(this._payload),
        this._gateway,
      ),
    };
  }

  get formHTML(): string {
    const form = this.form;

    const inputs = Object.entries(form)
      .map(
        ([key, value]) =>
            `<input type="hidden" name="${key}" value="${value}" />`,
      )
      .join('\n');

    return `<!DOCTYPE html>
<html>
  <body onload="document.forms['fm'].submit();">
    <form name="fm" action="${this.bindingURL}" method="post">
      ${inputs}
    </form>
  </body>
</html>`;
  }

  get bindingURL(): string {
    return this._gateway.getBindingURL();
  }

  get cardId(): string | undefined {
    return this._cardId;
  }

  get cardNumberPrefix(): string | undefined {
    return this._cardNumberPrefix;
  }

  get cardNumberSuffix(): string | undefined {
    return this._cardNumberSuffix;
  }

  get bindingDate(): Date | undefined {
    return this._bindingDate;
  }

  get state(): CTBCBindCardRequestState {
    if (this._failedCode) return CTBCBindCardRequestState.FAILED;
    if (this._cardId) return CTBCBindCardRequestState.BOUND;
    if (this._resolved) return CTBCBindCardRequestState.FORM_GENERATED;

    return CTBCBindCardRequestState.INITED;
  }

  get expireDate(): Promise<Date> {
    return this._bindingDate
      ? Promise.resolve(this._bindingDate)
      : Promise.reject(new Error('expireDate not available'));
  }

  get failedMessage(): { code: string; message: string } | null {
    if (!this._failedCode) return null;

    return { code: this._failedCode, message: this._failedMessage! };
  }

  bound(payload: CTBCBindCardCallbackPayload): void {
    this._cardId = payload.CardToken;
    this._cardNumberPrefix = payload.CardNoMask.slice(0, 6);
    this._cardNumberSuffix = payload.CardNoMask.slice(-4);
    this._bindingDate = DateTime.fromFormat(
      payload.ResponseTime,
      'yyyy/MM/dd HH:mm:ss',
    ).toJSDate();

    this._gateway.emitter.emit(PaymentEvents.CARD_BOUND, this);
  }

  fail(
    code: string,
    message: string,
    payload?: CTBCBindCardCallbackPayload,
  ): void {
    this._failedCode = code;
    this._failedMessage = message;

    if (payload) {
      this._cardId = payload.CardToken;
      this._cardNumberPrefix = payload.CardNoMask.slice(0, 6);
      this._cardNumberSuffix = payload.CardNoMask.slice(-4);
    }

    this._gateway.emitter.emit(PaymentEvents.CARD_BINDING_FAILED, this);
  }
}
