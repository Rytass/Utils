import { AdditionalInfo, AsyncOrderInformation, Order, OrderState, PaymentEvents } from '@rytass/payments';
import { HwaNanOrderItem } from './hwanan-order-item';
import { HwaNanPayment } from './hwanan-payment';
import { HwaNanCommitMessage, HwaNanPrepareOrderInit, HwaNanMakeOrderPayload, HwaNanPaymentChannel, HwaNanCreditCardCommitMessage } from './typings';

export class HwaNanOrder<OCM extends HwaNanCommitMessage = HwaNanCreditCardCommitMessage> implements Order<OCM> {
  private readonly _id: string;

  private readonly _items: HwaNanOrderItem[];

  private readonly _gateway: HwaNanPayment<OCM>;

  private readonly _makePayload: HwaNanMakeOrderPayload | undefined;

  private _state = OrderState.INITED;

  private _failedCode: string | undefined;

  private _failedMessage: string | undefined;

  private _committedAt: Date | null = null;

  private _createdAt: Date | null = null;

  private _channel: HwaNanPaymentChannel | undefined;

  private _asyncInfo?: AsyncOrderInformation<OCM>;

  constructor(options: HwaNanPrepareOrderInit<OCM>, additionalInfo?: AdditionalInfo<OCM>) {
    this._id = options.id;
    this._items = options.items.map(item => new HwaNanOrderItem(item));
    this._gateway = options.gateway;

    if ('makePayload' in options) {
      this._makePayload = options.makePayload;
    }
  }

  get id() {
    return this._id;
  }

  get items() {
    return this._items;
  }

  get state() {
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

  get failedMessage() {
    if (this._state !== OrderState.FAILED) return null;

    return {
      code: this._failedCode as string,
      message: this._failedMessage as string,
    };
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
    if (!this.committable) throw new Error(`Only pre-commit, info-retrieved order can commit, now: ${this._state}`);

    if (this._id !== message.id) {
      throw new Error(`Order ID not matched, given: ${message.id} actual: ${this._id}`);
    }
  }

  async refund() {
    if (this._state !== OrderState.COMMITTED) {
      throw new Error('Only committed order can be refunded');
    }

    if (this._channel !== HwaNanPaymentChannel.CREDIT) {
      throw new Error('Only credit card order can be refunded');
    }
  }
}
