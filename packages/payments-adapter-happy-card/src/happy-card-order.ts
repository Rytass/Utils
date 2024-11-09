import {
  Order,
  OrderFailMessage,
  OrderState,
  PaymentEvents,
} from '@rytass/payments';
import axios from 'axios';
import {
  HappyCardCommitMessage,
  HappyCardOrderInitOptions,
  HappyCardRefundRequest,
  HappyCardRefundResponse,
} from './typings';
import { HappyCardOrderItem } from './happy-card-order-item';
import { HappyCardPayment } from './happy-card-payment';
import {
  HappyCardPayRequest,
  HappyCardPayResponse,
  HappyCardResultCode,
} from './typings';

export class HappyCardOrder<OCM extends HappyCardCommitMessage>
  implements Order<OCM>
{
  private readonly _id: string;
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

    const payload: HappyCardPayRequest = {
      basedata: this._gateway.getBaseData(this._isIsland),
      ...this._payload,
    };

    const { data } = await axios.post<HappyCardPayResponse>(
      `${this.gateway.baseUrl}/Pay`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.resultCode !== HappyCardResultCode.SUCCESS) {
      await this.fail(data.resultCode, data.resultMsg);

      return;
    }

    this._committedAt = new Date();
    this._state = OrderState.COMMITTED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);
  }

  async refund(): Promise<void> {
    if (this._state !== OrderState.COMMITTED) {
      throw new Error('Order is not committed');
    }

    const { data } = await axios.post<HappyCardRefundResponse>(
      `${this.gateway.baseUrl}/CancelPay`,
      JSON.stringify({
        basedata: this._gateway.getBaseData(this._isIsland),
        type: 2,
        card_list: [
          {
            request_no: this.id,
            pos_trade_no: this.posTradeNo,
            card_sn: this._payload.card_list[0].card_sn,
          },
        ],
      } as HappyCardRefundRequest),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.resultCode !== HappyCardResultCode.SUCCESS) {
      await this.fail(data.resultCode, data.resultMsg);

      return;
    }

    this._state = OrderState.REFUNDED;
  }
}
