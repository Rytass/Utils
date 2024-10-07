import {
  AdditionalInfo,
  Order,
  OrderFailMessage,
  OrderState,
  PaymentEvents,
} from '@rytass/payments';
import { HappyCardCommitMessage, HappyCardOrderInitOptions } from './typings';
import { HappyCardOrderItem } from './happy-card-order-item';
import { BadRequestException } from '@nestjs/common';
import { HappyCardPayment } from './happy-card-payment';

export class HappyCardOrder<OCM extends HappyCardCommitMessage>
  implements Order<OCM>
{
  private readonly _id: string;
  private readonly _items: HappyCardOrderItem[];
  private readonly _gateway: HappyCardPayment<OCM>;
  private readonly _state: OrderState;
  private readonly _createdAt: Date;
  private readonly _committedAt: Date | null;
  private readonly _failedCode: string | undefined;
  private readonly _failedMessage: string | undefined;

  constructor(options: HappyCardOrderInitOptions) {
    this._id = options.id;
    this._items = options.items;
    this._gateway = options.gateway;
    this._createdAt = options.createdAt;
    this._state = options.committedAt
      ? OrderState.COMMITTED
      : OrderState.FAILED;
    this._committedAt = options.committedAt;
    this._failedCode = options.failedCode;
    this._failedMessage = options.failedMessage;
  }

  get id(): string {
    return this._id;
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

  get failedMessage(): OrderFailMessage | null {
    if (this._state !== OrderState.FAILED) return null;

    return {
      code: this._failedCode as string,
      message: this._failedMessage as string,
    };
  }

  get committable(): boolean {
    return false; // Always committed after created
  }

  infoRetrieved(): void {
    throw new BadRequestException(
      'Happy card order does not support async info',
    );
  }

  fail(): void {
    throw new BadRequestException(
      'Happy card order does not support fail after created',
    );
  }

  commit(): void {
    throw new BadRequestException(
      'Happy card order does not support commit after created',
    );
  }

  refund(): Promise<void> {
    throw new BadRequestException('Happy card order does not support refund');
  }
}
