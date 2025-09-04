import { DateTime } from 'luxon';
import { ECPayPayment } from './ecpay-payment';
import {
  ECPayBindCardCallbackPayload,
  ECPayBindCardRequestPayload,
  ECPayBindCardRequestState,
  ECPayBindCardWithTransactionRequestOptions,
} from './typings';
import { BindCardRequest, OrderFailMessage, PaymentEvents } from '@rytass/payments';

export class ECPayBindCardRequest implements BindCardRequest {
  private readonly _form: ECPayBindCardRequestPayload | undefined;
  private readonly _gateway: ECPayPayment;

  private _resolved = false;

  private _cardId: string | undefined;
  private _cardNumberPrefix: string | undefined;
  private _cardNumberSuffix: string | undefined;
  private _bindingDate: Date | undefined;
  private _expireDate: Date | undefined;

  private _failedCode: string | undefined;
  private _failedMessage: string | undefined;

  private readonly _memberId: string;

  constructor(
    options: ECPayBindCardRequestPayload | ECPayBindCardWithTransactionRequestOptions,
    gateway: ECPayPayment,
  ) {
    if ('ServerReplyURL' in options) {
      this._form = options as ECPayBindCardRequestPayload;
      this._memberId = options.MerchantMemberID.replace(new RegExp(`^${options.MerchantID}`), '');
    } else {
      this._resolved = true;
      this._memberId = options.memberId;
      this._cardId = options.cardId;
      this._cardNumberPrefix = options.cardNumberPrefix;
      this._cardNumberSuffix = options.cardNumberSuffix;
      this._bindingDate = options.bindingDate;
    }

    this._gateway = gateway;
  }

  get memberId(): string {
    return this._memberId;
  }

  get form(): ECPayBindCardRequestPayload {
    if (this._resolved) throw new Error('Form has been resolved');

    this._resolved = true;

    return this._form as ECPayBindCardRequestPayload;
  }

  get formHTML(): string {
    return `<!DOCTYPE html>
<html>
  <head>
    <title>Payment Submit Form</title>
  </head>
  <body>
    <form action="${this._gateway.baseUrl}/MerchantMember/BindingCardID" method="POST">
      ${Object.entries(this.form)
        .map(([key, value]) => `<input name="${key}" value="${value}" type="hidden" />`)
        .join('\n')}
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

  get failedMessage(): OrderFailMessage | null {
    if (!this._failedCode) return null;

    return {
      code: this._failedCode as string,
      message: this._failedMessage as string,
    };
  }

  get expireDate(): Promise<Date> {
    if (this._expireDate) return Promise.resolve(this._expireDate);

    return new Promise<Date>(async (resolve, reject) => {
      try {
        const boundCardInfo = await this._gateway.queryBoundCard(this.memberId);

        this._expireDate = boundCardInfo.expireDate as Date;

        resolve(boundCardInfo.expireDate as Date);
      } catch (ex) {
        reject(ex);
      }
    });
  }

  bound(payload: ECPayBindCardCallbackPayload): void {
    this._cardId = payload.CardID;
    this._cardNumberPrefix = payload.Card6No;
    this._cardNumberSuffix = payload.Card4No;
    this._bindingDate = DateTime.fromFormat(payload.BindingDate, 'yyyy/MM/dd HH:mm:ss').toJSDate();

    this._gateway.emitter.emit(PaymentEvents.CARD_BOUND, this);
  }

  fail(returnCode: string, message: string, additionalPayload?: ECPayBindCardCallbackPayload): void {
    this._failedCode = returnCode;
    this._failedMessage = message;

    if (additionalPayload) {
      this._cardId = additionalPayload.CardID;
      this._cardNumberPrefix = additionalPayload.Card6No;
      this._cardNumberSuffix = additionalPayload.Card4No;
      this._bindingDate = DateTime.fromFormat(additionalPayload.BindingDate, 'yyyy/MM/dd HH:mm:ss').toJSDate();
    }

    this._gateway.emitter.emit(PaymentEvents.CARD_BINDING_FAILED, this);
  }
}
