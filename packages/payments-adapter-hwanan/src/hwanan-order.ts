import { AdditionalInfo, AsyncOrderInformation, Order, OrderState, PaymentEvents } from '@rytass/payments';
import { HwaNanOrderItem } from './hwanan-order-item';
import { HwaNanPayment } from './hwanan-payment';
import {
  HwaNanCommitMessage,
  HwaNanPrepareOrderInit,
  HwaNanMakeOrderPayload,
  HwaNanPaymentChannel,
  HwaNanCreditCardCommitMessage,
} from './typings';

export class HwaNanOrder<OCM extends HwaNanCommitMessage = HwaNanCreditCardCommitMessage> implements Order<OCM> {
  private readonly _id: string;

  private readonly _items: HwaNanOrderItem[];

  private readonly _gateway: HwaNanPayment<OCM>;

  private readonly _makePayload: HwaNanMakeOrderPayload | undefined;

  private _state = OrderState.INITED;

  private _failedCode: string | undefined;

  private _failedMessage: string | undefined;

  private _committedAt: Date | null = null;

  private readonly _createdAt: Date | null = null;

  private _platformTradeNumber: string | null = null;

  private _channel: HwaNanPaymentChannel | undefined;

  private _additionalInfo?: AdditionalInfo<OCM>;

  constructor(options: HwaNanPrepareOrderInit<OCM>, additionalInfo?: AdditionalInfo<OCM>) {
    this._id = options.id;
    this._items = options.items.map(item => new HwaNanOrderItem(item));
    this._gateway = options.gateway;
    this._createdAt = new Date();

    if ('makePayload' in options) {
      this._makePayload = options.makePayload;
    }

    this._additionalInfo = additionalInfo;
  }

  get id(): string {
    return this._id;
  }

  get items(): HwaNanOrderItem[] {
    return this._items;
  }

  get state(): OrderState {
    return this._state;
  }

  get committable(): boolean {
    return !!~[OrderState.PRE_COMMIT, OrderState.ASYNC_INFO_RETRIEVED].indexOf(this._state);
  }

  get createdAt(): Date | null {
    return this._createdAt;
  }

  get committedAt(): Date | null {
    return this._committedAt;
  }

  get failedMessage(): { code: string; message: string } | null {
    if (this._state !== OrderState.FAILED) return null;

    return {
      code: this._failedCode as string,
      message: this._failedMessage as string,
    };
  }

  get totalPrice(): number {
    return this.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  // Additional information
  get additionalInfo(): AdditionalInfo<OCM> | undefined {
    return this._additionalInfo;
  }

  get platformTradeNumber(): string | null {
    return this._platformTradeNumber;
  }

  get form(): HwaNanMakeOrderPayload {
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

  fail(returnCode: string, message: string): void {
    this._failedCode = returnCode;
    this._failedMessage = message;

    this._state = OrderState.FAILED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);
  }

  infoRetrieved<T extends OCM>(_asyncInformation: AsyncOrderInformation<T>): void {
    throw new Error('Hwa Nan Bank not support async info retrieve');
  }

  commit<T extends OCM>(message: T, additionalInfo?: AdditionalInfo<T>): void {
    if (!this.committable) throw new Error(`Only pre-commit, info-retrieved order can commit, now: ${this._state}`);

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

  async refund(): Promise<void> {
    throw new Error('Hwa Nan Bank not support refund');
  }
}
