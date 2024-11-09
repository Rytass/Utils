import {
  Order,
  OrderFailMessage,
  OrderState,
  PaymentEvents,
} from '@rytass/payments';
import { ICashPayOrderItem } from './icash-pay-order-item';
import { ICashPayPayment } from './icash-pay-payment';
import {
  ICashPayCommitMessage,
  ICashPayPaymentType,
  ICashPayOrderInitOptions,
} from './typing';

export class ICashPayOrder<
  OCM extends ICashPayCommitMessage = ICashPayCommitMessage,
> implements Order<OCM>
{
  private readonly _id: string;
  private readonly _items: ICashPayOrderItem[];
  private readonly _gateway: ICashPayPayment<OCM>;
  private readonly _createdAt: Date;
  private readonly _state: OrderState;
  private readonly _committedAt: Date | null;
  private readonly _failedCode: string | undefined;
  private readonly _failedMessage: string | undefined;

  readonly transactionId?: string;
  readonly icpAccount?: string;
  readonly paymentType?: ICashPayPaymentType;
  readonly boundMemberId?: string;
  readonly invoiceMobileCarrier?: string;
  readonly creditCardFirstSix?: string;
  readonly creditCardLastFour?: string;
  readonly isTWQRCode: boolean;
  readonly twqrIssueCode?: string;
  readonly uniGID?: string;

  constructor(options: ICashPayOrderInitOptions) {
    this._id = options.id;
    this._items = options.items;
    this._gateway = options.gateway;
    this._createdAt = options.createdAt;
    this._committedAt = options.committedAt ?? null;
    this._failedCode = options.failedCode;
    this._failedMessage = options.failedMessage;
    this._state = options.isRefunded
      ? OrderState.REFUNDED
      : options.committedAt
        ? OrderState.COMMITTED
        : OrderState.FAILED;

    this.transactionId = options.transactionId;
    this.icpAccount = options.icpAccount;
    this.paymentType = options.paymentType;
    this.boundMemberId = options.boundMemberId;
    this.invoiceMobileCarrier = options.invoiceMobileCarrier;
    this.creditCardFirstSix = options.creditCardFirstSix;
    this.creditCardLastFour = options.creditCardLastFour;
    this.isTWQRCode = options.isTWQRCode;
    this.twqrIssueCode = options.twqrIssueCode;
    this.uniGID = options.uniGID;
  }

  get id(): string {
    return this._id;
  }

  get items(): ICashPayOrderItem[] {
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

  get gateway(): ICashPayPayment<OCM> {
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
    throw new Error('iCash Pay order does not support async info');
  }

  fail(returnCode: string, message: string): void {
    throw new Error('Method not implemented.');
  }

  async commit(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async refund(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
