import { DateTime } from 'luxon';
import { ECPayPayment } from './ecpay-payment';
import { ECPayBindCardCallbackPayload, ECPayBindCardRequestPayload, ECPayBindCardRequestState, ECPayCommitMessage } from './typings';
import { PaymentEvents } from '@rytass/payments';

export class ECPayBindCardRequest {
  private readonly _form: ECPayBindCardRequestPayload;
  private readonly _gateway: ECPayPayment;

  private _resolved = false;

  private _cardId: string | undefined;
  private _cardNumberPrefix: string | undefined;
  private _cardNumberSuffix: string | undefined;
  private _bindingDate: Date | undefined;

  private _failedCode: string | undefined;
  private _failedMessage: string | undefined;

  constructor(options: ECPayBindCardRequestPayload, gateway: ECPayPayment) {
    this._form = options;
    this._gateway = gateway;
  }

  get memberId(): string {
    return this._form.MerchantMemberID.replace(new RegExp(`^${this._form.MerchantID}`), '');
  }

  get form(): ECPayBindCardRequestPayload {
    if (this._resolved) throw new Error('Form has been resolved');

    this._resolved = true;

    return this._form;
  }

  get formHTML(): string {
    return `<!DOCTYPE html>
<html>
  <head>
    <title>Payment Submit Form</title>
  </head>
  <body>
    <form action="${this._gateway.baseUrl}/MerchantMember/BindingCardID" method="POST">
      ${Object.entries(this.form).map(([key, value]) => `<input name="${key}" value="${value}" type="hidden" />`).join('\n')}
    </form>
    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>`;
  }

  get bindingURL(): string {
    if (!this._gateway._server) {
      throw new Error('To use automatic checkout server, please initial payment with `withServer` options.');
    }

    return this._gateway.getBindingURL(this);
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

  get state(): ECPayBindCardRequestState {
    if (this._failedCode) return ECPayBindCardRequestState.FAILED;

    if (this._cardId) return ECPayBindCardRequestState.BOUND;

    if (this._resolved) return ECPayBindCardRequestState.FORM_GENERATED;

    return ECPayBindCardRequestState.INITED;
  }

  get failedMessage() {
    if (!this._failedCode) return null;

    return {
      code: this._failedCode as string,
      message: this._failedMessage as string,
    };
  }

  bound(payload: ECPayBindCardCallbackPayload) {
    this._cardId = payload.CardID;
    this._cardNumberPrefix = payload.Card6No;
    this._cardNumberSuffix = payload.Card4No;
    this._bindingDate = DateTime.fromFormat(payload.BindingDate, 'yyyy/MM/dd HH:mm:ss').toJSDate();

    this._gateway.emitter.emit(PaymentEvents.CARD_BOUND, this);
  }

  fail(returnCode: string, message: string) {
    this._failedCode = returnCode;
    this._failedMessage = message;

    this._gateway.emitter.emit(PaymentEvents.CARD_BINDING_FAILED, this);
  }
}
