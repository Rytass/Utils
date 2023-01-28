import { AdditionalInfo, AsyncOrderInformation, Order, OrderState, PaymentEvents } from '@rytass/payments';
import { NewebPayOrderItem } from './newebpay-order-item';
import { NewebPayPayment } from './newebpay-payment';
import { NewebPayCommitMessage, NewebPaymentChannel, NewebPayMPGMakeOrderPayload, NewebPayPrepareOrderInit } from './typings';

export class NewebPayOrder<OCM extends NewebPayCommitMessage> implements Order<OCM> {
  private readonly _id: string;

  private readonly _items: NewebPayOrderItem[];

  private readonly _gateway: NewebPayPayment<OCM>;

  private readonly _makePayload: NewebPayMPGMakeOrderPayload | null;

  private _state = OrderState.INITED;

  private _failedCode: string | undefined;

  private _failedMessage: string | undefined;

  private _committedAt: Date | null = null;

  private _createdAt: Date | null = null;

  private _platformTradeNumber: string | null = null;

  private _channel: NewebPaymentChannel | undefined;

  private _asyncInfo?: AsyncOrderInformation<OCM>;

  private _additionalInfo?: AdditionalInfo<OCM>;

  constructor(options: NewebPayPrepareOrderInit<OCM>) {
    this._id = options.id;
    this._items = options.items;
    this._gateway = options.gateway;
    this._makePayload = options.makePayload ?? null;
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

  get form(): NewebPayMPGMakeOrderPayload {
    if (~[OrderState.COMMITTED, OrderState.FAILED].indexOf(this._state)) {
      throw new Error('Finished order cannot get submit form data');
    }

    this._state = OrderState.PRE_COMMIT;

    return this._makePayload!;
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

    if (!this._gateway._server) {
      throw new Error('To use automatic checkout server, please initial payment with `withServer` options.');
    }

    return this._gateway.getCheckoutUrl(this);
  }

  get state() {
    return this._state;
  }

  get commitable(): boolean {
    return !!~[OrderState.PRE_COMMIT, OrderState.ASYNC_INFO_RETRIEVED].indexOf(this._state);
  }

  get createdAt(): Date | null {
    return this._createdAt;
  }

  get committedAt(): Date | null {
    return this._committedAt;
  }

  get failedMessage() {
    if (this._state !== OrderState.FAILED) return null;

    return {
      code: this._failedCode as string,
      message: this._failedMessage as string,
    };
  }

  // Async order infomation
  get asyncInfo() {
    return this._asyncInfo;
  }

  // Additional infomation
  get additionalInfo() {
    return this._additionalInfo;
  }

  get platformTradeNumber(): string | null {
    return this._platformTradeNumber;
  }

  get channel(): NewebPaymentChannel | undefined {
    return this._channel;
  }

  fail(returnCode: string, message: string) {
    this._failedCode = returnCode;
    this._failedMessage = message;

    this._state = OrderState.FAILED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);
  }

  infoRetrieved<T extends OCM>(asyncInformation: AsyncOrderInformation<T>) {
    if (this._state !== OrderState.PRE_COMMIT) throw new Error(`Only pre-commit order can commit, now: ${this._state}`);

    this._asyncInfo = asyncInformation;

    this._state = OrderState.ASYNC_INFO_RETRIEVED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_INFO_RETRIEVED, this);
  }

  commit<T extends OCM>(message: T, additionalInfo?: AdditionalInfo<T>) {
    if (!this.commitable) throw new Error(`Only pre-commit, info-retrieved order can commit, now: ${this._state}`);

    if (this._id !== message.id) {
      throw new Error(`Order ID not matched, given: ${message.id} actual: ${this._id}`);
    }

    this._additionalInfo = additionalInfo;
    this._committedAt = message.committedAt;
    this._platformTradeNumber = message.platformTradeNumber;
    this._channel = message.channel;
    this._state = OrderState.COMMITTED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);
  }

  async refund() {

  }
}
