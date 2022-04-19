import { CreditCardAuthInfo, Order, OrderCommitAdditionalInformation, OrderCommitMessage, OrderState, PaymentEvents } from '@rytass/payments';
import { DateTime } from 'luxon';
import { ECPayPayment } from '.';
import { ECPayOrderItem } from './ecpay-order-item';
import { ECPayCommitMessage, ECPayOrderForm, OrderInit } from './typings';

export class ECPayOrder<OCM extends ECPayCommitMessage> implements Order<OCM> {
  private readonly _id: string;

  private readonly _items: ECPayOrderItem[];

  private readonly _form: ECPayOrderForm;

  private readonly gateway: ECPayPayment;

  private _creditCardAuthInfo?: CreditCardAuthInfo;

  private _committedAt: Date | null = null;

  private _createdAt: Date | null = null;

  private _platformTradeNumber: string | null = null;

  private _state: OrderState;

  constructor(options: OrderInit) {
    this._id = options.id;
    this._items = options.items.map((item) => new ECPayOrderItem(item));
    this._form = options.form;
    this.gateway = options.gateway;
    this._state = OrderState.INITED;
  }

  get id() {
    return this._id;
  }

  get items() {
    return this._items;
  }

  get totalPrice() {
    return this.items.reduce((sum, item) => (
      sum + (item.unitPrice * item.quantity)
    ), 0);
  }

  get form(): ECPayOrderForm {
    this._state = OrderState.PRE_COMMIT;

    return this._form;
  }

  get formHTML(): string {
    this._state = OrderState.PRE_COMMIT;

    return `<!DOCTYPE html>
<html>
  <head>
    <title>Payment Submit Form</title>
  </head>
  <body>
    <form action="${this.gateway.baseUrl}/Cashier/AioCheckOut/V5" method="POST">
      ${Object.entries(this.form).map(([key, value]) => `<input name="${key}" value="${value}" type="hidden" />`).join('\n')}
    </form>
    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>`;
  }

  get checkoutURL(): string {
    this._state = OrderState.PRE_COMMIT;

    if (!this.gateway._server) {
      throw new Error('To use automatic checkout server, please initial payment with `withServer` options.');
    }

    return this.gateway.getCheckoutUrl(this);
  }

  get commitable(): boolean {
    return this._state === OrderState.PRE_COMMIT;
  }

  get state(): OrderState {
    return this._state;
  }

  get createdAt(): Date | null {
    return this._createdAt;
  }

  get committedAt(): Date | null {
    return this._committedAt;
  }

  get creditCardAuthInfo(): CreditCardAuthInfo | undefined {
    return this._creditCardAuthInfo;
  }

  get platformTradeNumber(): string | null {
    return this._platformTradeNumber;
  }

  commit<T extends OCM>(message: T, additionalInfo?: OrderCommitAdditionalInformation) {
    if (this._state !== OrderState.PRE_COMMIT) throw new Error(`Only pre-commit order can commit, now: ${this._state}`);

    if (this._id !== message.id) {
      throw new Error(`Order ID not matched, given: ${message.id} actual: ${this._id}`);
    }

    if (this._form.MerchantID !== message.merchantId) {
      throw new Error(`Merchant ID not matched, given: ${message.merchantId} actual: ${this._form.MerchantID}`);
    }

    if (Number(this._form.TotalAmount) !== message.totalPrice) {
      throw new Error(`Total amount not matched, given: ${message.totalPrice} actual: ${this._form.TotalAmount}`);
    }

    this._committedAt = message.committedAt;
    this._createdAt = message.tradeDate;
    this._platformTradeNumber = message.tradeNumber;

    if (additionalInfo?.creditCardAuthInfo) {
      this._creditCardAuthInfo = additionalInfo.creditCardAuthInfo;
    }

    this._state = OrderState.COMMITTED;

    this.gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);
  }
}

