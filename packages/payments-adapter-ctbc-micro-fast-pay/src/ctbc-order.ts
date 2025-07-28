import {
  Order,
  OrderState,
  OrderFailMessage,
  PaymentItem,
  AsyncOrderInformation,
  PaymentEvents,
  AdditionalInfo,
} from '@rytass/payments';
import { CTBCPayment } from './ctbc-payment';
import {
  CTBCCheckoutWithBoundCardRequestPayload,
  CTBCOrderCommitMessage,
  CTBCPayOrderForm,
  OrderCreateInit,
} from './typings';

export class CTBCOrder<
  OCM extends CTBCOrderCommitMessage = CTBCOrderCommitMessage,
> implements Order<OCM>
{
  private readonly _id: string;
  private readonly _items: PaymentItem[];
  private readonly _form: CTBCPayOrderForm | undefined;
  private readonly _gateway: CTBCPayment<OCM>;

  private _additionalInfo?: AdditionalInfo<OCM>;
  private _asyncInfo?: AsyncOrderInformation<OCM>;
  private _committedAt: Date | null = null;
  private _createdAt: Date | null = null;
  private _state: OrderState;
  private _failedCode: string | undefined;
  private _failedMessage: string | undefined;
  private _clientBackUrl: string | undefined;

  private _checkoutMemberId: string | null = null;
  private _checkoutCardId: string | null = null;

  constructor(options: OrderCreateInit<OCM>) {
    this._id = options.id;
    this._items = options.items;
    this._gateway = options.gateway;

    if ('form' in options) {
      this._form = options.form;
      this._clientBackUrl = options.clientBackUrl ?? undefined;
      this._state = OrderState.INITED;
    } else {
      this._checkoutCardId = options.checkoutCardId ?? null;
      this._checkoutMemberId = options.checkoutMemberId ?? null;
      this._state = OrderState.PRE_COMMIT;
    }

    this._createdAt = options.createdAt ?? new Date();
  }

  get id(): string {
    return this._id;
  }

  get clientBackUrl(): string | undefined {
    return this._clientBackUrl;
  }

  get items(): PaymentItem[] {
    return this._items;
  }

  get totalPrice(): number {
    return this.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
  }

  get form(): CTBCPayOrderForm {
    if (~[OrderState.COMMITTED, OrderState.FAILED].indexOf(this._state)) {
      throw new Error('Finished order cannot get submit form data');
    }

    this._state = OrderState.PRE_COMMIT;

    return this._form!;
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
    <form action="${this._gateway.baseUrl}/mauth/SSLAuthUI.jsp" method="POST">
      ${Object.entries(this.form)
        .map(
          ([key, value]) =>
            `<input name="${key}" value="${value}" type="hidden" />`,
        )
        .join('\n')}
    </form>
    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>`;
  }

  get committable(): boolean {
    return !!~[OrderState.PRE_COMMIT, OrderState.ASYNC_INFO_RETRIEVED].indexOf(
      this._state,
    );
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

  // Additional information
  get additionalInfo(): AdditionalInfo<OCM> | undefined {
    return this._additionalInfo;
  }

  get failedMessage(): OrderFailMessage | null {
    if (this._state !== OrderState.FAILED) return null;

    return {
      code: this._failedCode as string,
      message: this._failedMessage as string,
    };
  }

  get checkoutMemberId(): string | null {
    return this._checkoutMemberId;
  }

  get checkoutCardId(): string | null {
    return this._checkoutCardId;
  }

  get asyncInfo(): AsyncOrderInformation<OCM> | undefined {
    return this._asyncInfo;
  }

  infoRetrieved(info: AsyncOrderInformation<OCM>): void {
    this._asyncInfo = info;
    this._state = OrderState.ASYNC_INFO_RETRIEVED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_INFO_RETRIEVED, this);
  }

  fail(code: string, message: string): void {
    this._failedCode = code;
    this._failedMessage = message;

    this._state = OrderState.FAILED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);
  }

  commit(message: OCM, additionalInfo?: AdditionalInfo<OCM>): void {
    if (!this.committable) {
      throw new Error(`Only pre-commit order can commit, now: ${this._state}`);
    }

    this._committedAt = message.committedAt;
    this._additionalInfo = additionalInfo;
    this._state = OrderState.COMMITTED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);
  }

  get boundCardCheckoutPayload(): CTBCCheckoutWithBoundCardRequestPayload {
    if (!this._checkoutCardId || !this._checkoutMemberId) {
      throw new Error(
        'Bound card checkout payload requires checkoutCardId and checkoutMemberId',
      );
    }

    return {
      MerID: this._gateway.merId,
      MemberID: this.checkoutMemberId as string,
      PurchAmt: this.totalPrice,
      TxType: 0,
      AuthResURL: this._gateway.boundCheckoutResultURL,
      AutoCap: 1,
      Lidm: this.id,
      RequestNo: this.id,
      Token: this.checkoutCardId as string,
      OrderDesc:
        this.items
          .map((item) => item.name)
          .join(', ')
          .substring(0, 18) || undefined, // Max 18 characters
      TerminalID: this._gateway.terminalId,
    } satisfies CTBCCheckoutWithBoundCardRequestPayload;
  }

  async refund(): Promise<void> {
    throw new Error('CTBCOrder.refund not implemented');
  }
}
