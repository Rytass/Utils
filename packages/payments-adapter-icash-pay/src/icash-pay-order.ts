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
  ICashPayRefundOptions,
} from './typing';
import { DateTime } from 'luxon';

export class ICashPayOrder<
  OCM extends ICashPayCommitMessage = ICashPayCommitMessage,
> implements Order<OCM>
{
  private readonly _id: string;
  private readonly _items: ICashPayOrderItem[];
  private readonly _gateway: ICashPayPayment<OCM>;
  private readonly _createdAt: Date;
  private readonly _deductEncData?: string;

  private _failedCode: string | undefined;
  private _failedMessage: string | undefined;
  private _state: OrderState;
  private _committedAt: Date | null;

  private _storeId: string | null;
  private _storeName: string;

  transactionId?: string;
  icpAccount?: string;
  paymentType?: ICashPayPaymentType;
  boundMemberId?: string;
  invoiceMobileCarrier?: string;
  creditCardFirstSix?: string;
  creditCardLastFour?: string;
  isTWQRCode: boolean;
  twqrIssueCode?: string;
  uniGID?: string;

  constructor(options: ICashPayOrderInitOptions) {
    this._id = options.id;
    this._items = options.items;
    this._gateway = options.gateway;
    this._createdAt = options.createdAt;
    this._committedAt = options.committedAt ?? null;
    this._failedCode = options.failedCode;
    this._failedMessage = options.failedMessage;
    this._deductEncData = options.deductEncData;

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

    if (this._deductEncData) {
      this._state = OrderState.PRE_COMMIT;
    } else if (options.isRefunded) {
      this._state = OrderState.REFUNDED;
    } else if (options.failedCode) {
      this.fail(options.failedCode, options.failedMessage as string);
    } else {
      this._state = OrderState.INITED;
    }
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
    return OrderState.PRE_COMMIT === this._state && !!this._deductEncData;
  }

  infoRetrieved(): void {
    throw new Error('iCash Pay order does not support async info');
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
      const response = await this._gateway.commit(
        this._deductEncData as string,
      );

      this._committedAt = DateTime.fromFormat(
        response.PaymentDate,
        'yyyy/MM/dd HH:mm:ss',
      ).toJSDate();

      this.transactionId = response.TransactionID;
      this.icpAccount = response.ICPAccount;
      this.paymentType = response.PaymentType;
      this.boundMemberId = response.MMemberID || undefined;
      this.invoiceMobileCarrier = response.MobileInvoiceCarry || undefined;

      this.creditCardFirstSix = response.MaskedPan
        ? response.MaskedPan.slice(0, 6)
        : undefined;

      this.creditCardLastFour = response.MaskedPan
        ? response.MaskedPan.slice(-4)
        : undefined;

      this.isTWQRCode = response.IsFiscTWQC === 1;
      this.twqrIssueCode = response.FiscTWQRIssCode || undefined;
      this.uniGID = response.GID || undefined;
      this._state = OrderState.COMMITTED;

      this._gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);
    } catch (ex) {
      /^\[(.+)\]\s(.*)$/.test((ex as Error).message);

      await this.fail(RegExp.$1, RegExp.$2);
    }
  }

  async refund(
    requestRefundAmount: number,
    options?: Pick<
      ICashPayRefundOptions,
      | 'requestRefundCollectedAmount'
      | 'requestRefundConsignmentAmount'
      | 'refundOrderId'
    >,
  ): Promise<void> {
    await this.gateway.refund({
      id: this._id,
      storeId: this._storeId ?? undefined,
      storeName: this._storeName,
      transactionId: this.transactionId as string,
      requestRefundAmount,
      requestRefundCollectedAmount: options?.requestRefundCollectedAmount ?? 0,
      requestRefundConsignmentAmount:
        options?.requestRefundConsignmentAmount ?? 0,
      refundOrderId: options?.refundOrderId ?? undefined,
    });
  }
}
