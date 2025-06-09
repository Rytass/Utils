import {
  Order,
  OrderFailMessage,
  OrderState,
  PaymentEvents,
} from '@rytass/payments';
import {
  HappyCardCommitMessage,
  HappyCardOrderInitOptions,
  HappyCardProductType,
} from './typings';
import { HappyCardOrderItem } from './happy-card-order-item';
import { HappyCardPayment } from './happy-card-payment';
import { HappyCardPayRequest } from './typings';

export class HappyCardOrder<OCM extends HappyCardCommitMessage>
  implements Order<OCM>
{
  private readonly _id: string;
  private readonly _productType: HappyCardProductType;
  private readonly _items: HappyCardOrderItem[];
  private readonly _gateway: HappyCardPayment<OCM>;
  private readonly _createdAt: Date;
  private readonly _posTradeNo: string;
  private readonly _isIsland: boolean;
  private readonly _payload: Omit<HappyCardPayRequest, 'basedata'>;

  private _state: OrderState;
  private _committedAt: Date | null;
  private _failedCode: string | undefined;
  private _failedMessage: string | undefined;

  constructor(options: HappyCardOrderInitOptions) {
    this._id = options.id;
    this._productType = options.productType;
    this._items = options.items;
    this._gateway = options.gateway;
    this._createdAt = options.createdAt;
    this._isIsland = options.isIsland ?? false;
    this._state = OrderState.PRE_COMMIT;
    this._posTradeNo = options.posTradeNo ?? '';
    this._payload = options.payload;
  }

  get id(): string {
    return this._id;
  }

  get productType(): string {
    return this._productType;
  }

  get posTradeNo(): string {
    return this._posTradeNo;
  }

  get items(): HappyCardOrderItem[] {
    return this._items;
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

  get gateway(): HappyCardPayment<OCM> {
    return this._gateway;
  }

  get failedMessage(): OrderFailMessage | null {
    if (this._state !== OrderState.FAILED) return null;

    return {
      code: this._failedCode as string,
      message: this._failedMessage as string,
    };
  }

  get committable(): boolean {
    return OrderState.PRE_COMMIT === this._state;
  }

  infoRetrieved(): void {
    throw new Error('Happy card order does not support async info');
  }

  fail(returnCode: string, message: string): void {
    this._failedCode = returnCode;
    this._failedMessage = message;

    this._state = OrderState.FAILED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);
  }

  async commit(): Promise<void> {
    if (!this.committable) throw new Error('Order is not committable');

    try {
      await this._gateway.commit({
        payload: this._payload,
        isIsland: this._isIsland,
      });

      this._committedAt = new Date();
      this._state = OrderState.COMMITTED;

      this._gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);
    } catch (ex) {
      /^\[(.+)\]\s(.*)$/.test((ex as Error).message);

      await this.fail(RegExp.$1, RegExp.$2);
    }
  }

  async refund(): Promise<void> {
    if (this._state !== OrderState.COMMITTED) {
      throw new Error('Order is not committed');
    }

    try {
      await this._gateway.refund({
        id: this.id,
        posTradeNo: this.posTradeNo,
        cardSerial: this._payload.card_list[0].card_sn,
        isIsland: this._isIsland,
      });

      this._state = OrderState.REFUNDED;
    } catch (ex) {
      /^\[(.+)\]\s(.*)$/.test((ex as Error).message);

      await this.fail(RegExp.$1, RegExp.$2);
    }
  }
}
