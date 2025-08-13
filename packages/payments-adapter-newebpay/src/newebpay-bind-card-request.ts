import { BindCardRequest, OrderState, PaymentEvents } from '@rytass/payments';
import { NewebPayPayment } from './newebpay-payment';
import {
  NewebPayBindCardRequestOptions,
  NewebPayBindCardRequestTradeInfoPayload,
  NewebPayBindCardResponseTradeInfoPayload,
  NewebPayMPGMakeOrderPayload,
} from './typings';
import { DateTime } from 'luxon';

export class NewebPayBindCardRequest implements BindCardRequest {
  private readonly _gateway: NewebPayPayment;
  private readonly _id: string;
  private readonly _form: NewebPayMPGMakeOrderPayload;

  private _state = OrderState.INITED;
  private _memberId: string;
  private _cardId: string | undefined;
  private _cardNumberPrefix: string | undefined;
  private _cardNumberSuffix: string | undefined;
  private _bindingDate: Date | undefined;
  private _expireDate: Date | undefined;

  private _failedCode: string | undefined;
  private _failedMessage: string | undefined;

  constructor(options: NewebPayBindCardRequestOptions) {
    this._id = options.id;
    this._gateway = options.gateway;
    this._form = options.form;
    this._memberId = options.memberId;
  }

  get id(): string {
    return this._id;
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

  get expireDate(): Date | undefined {
    return this._expireDate;
  }

  get memberId(): string {
    return this._memberId;
  }

  get state(): OrderState {
    return this._state;
  }

  get committable(): boolean {
    return this._state === OrderState.PRE_COMMIT;
  }

  get failedMessage(): {
    code: string;
    message: string;
  } | null {
    if (this._state !== OrderState.FAILED) return null;

    return {
      code: this._failedCode as string,
      message: this._failedMessage as string,
    };
  }

  get form(): NewebPayMPGMakeOrderPayload {
    if (~[OrderState.COMMITTED, OrderState.FAILED].indexOf(this._state)) {
      throw new Error('Finished order cannot get submit form data');
    }

    this._state = OrderState.PRE_COMMIT;

    return this._form;
  }

  get formHTML(): string {
    if (~[OrderState.COMMITTED, OrderState.FAILED].indexOf(this._state)) {
      throw new Error('Finished order cannot get submit form url');
    }

    this._state = OrderState.PRE_COMMIT;

    return `<!DOCTYPE html>
<html>
  <head>
    <title>Payment Submit Form</title>
  </head>
  <body>
    <form action="${this._gateway.checkoutActionUrl}" method="POST">
      ${Object.entries(this.form)
        .map(
          ([key, value]) =>
            `<input name="${key}" value="${value}" type="hidden" />`,
        )
        .join('\n')}
    </form>
    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>`;
  }

  fail(returnCode: string, message: string): void {
    this._failedCode = returnCode;
    this._failedMessage = message;

    this._state = OrderState.FAILED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);
  }

  bound(payload: NewebPayBindCardResponseTradeInfoPayload): void {
    this._cardId = payload.TokenValue;
    this._cardNumberPrefix = payload.Card6No;
    this._cardNumberSuffix = payload.Card4No;
    this._bindingDate = DateTime.fromFormat(
      payload.PayTime,
      'yyyy-MM-dd HH:mm:ss',
    ).toJSDate();

    this._expireDate = DateTime.fromFormat(payload.Exp, 'yyMM')
      .endOf('month')
      .toJSDate();

    this._state = OrderState.COMMITTED;

    this._gateway.emitter.emit(PaymentEvents.CARD_BOUND, this);
  }
}
