import { CreditCardAuthInfo, Order, OrderState, PaymentEvents } from '@rytass/payments';
import { DateTime } from 'luxon';
import { ECPayPayment } from '.';
import { ECPayOrderItem } from './ecpay-order-item';
import { ECPayCommitMessage, ECPayOrderForm, OrderInit } from './typings';

export class ECPayOrder implements Order {
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

  get formHTML() {
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

  get checkoutURL() {
    this._state = OrderState.PRE_COMMIT;

    if (!this.gateway._server) {
      throw new Error('To use automatic checkout server, please initial payment with `withServer` options.');
    }

    return this.gateway.getCheckoutUrl(this);
  }

  get commitable() {
    return this._state === OrderState.PRE_COMMIT;
  }

  commit(message: ECPayCommitMessage) {
    if (this._state !== OrderState.PRE_COMMIT) throw new Error(`Only pre-commit order can commit, now: ${this._state}`);

    if (this._id !== message.merchantTradeNumber) {
      throw new Error(`Order ID not matched, given: ${message.merchantTradeNumber} actual: ${this._id}`);
    }

    if (this._form.MerchantID !== message.merchantId) {
      throw new Error(`Merchant ID not matched, given: ${message.merchantId} actual: ${this._form.MerchantID}`);
    }

    if (Number(this._form.TotalAmount) !== message.tradeAmount) {
      throw new Error(`Total amount not matched, given: ${message.tradeAmount} actual: ${this._form.TotalAmount}`);
    }

    this._committedAt = message.paymentDate;
    this._createdAt = message.tradeDate;
    this._platformTradeNumber = message.tradeNumber;

    this._state = OrderState.COMMITTED;

    this.gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);
  }
}

