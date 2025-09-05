import { AdditionalInfo, AsyncOrderInformation, Order, OrderState, PaymentEvents } from '@rytass/payments';
import { NewebPayOrderItem } from './newebpay-order-item';
import { NewebPayPayment } from './newebpay-payment';
import {
  NewebPayCommitMessage,
  NewebPayCreditCardBalanceStatus,
  NewebPaymentChannel,
  NewebPayMPGMakeOrderPayload,
  NewebPayOrderFromServerInit,
  NewebPayOrderStatusFromAPI,
  NewebPayPrepareOrderInit,
} from './typings';
import { NewebPayAdditionInfoCreditCard, NewebPayCreditCardCommitMessage } from './typings/credit-card.typing';

export class NewebPayOrder<OCM extends NewebPayCommitMessage = NewebPayCommitMessage> implements Order<OCM> {
  private readonly _id: string;

  private readonly _items: NewebPayOrderItem[];

  private readonly _gateway: NewebPayPayment<OCM>;

  private readonly _makePayload: NewebPayMPGMakeOrderPayload | undefined;

  private _state = OrderState.INITED;

  private _failedCode: string | undefined;

  private _failedMessage: string | undefined;

  private _committedAt: Date | null = null;

  private readonly _createdAt: Date | null = null;

  private _platformTradeNumber: string | null = null;

  private _channel: NewebPaymentChannel | undefined;

  private _asyncInfo?: AsyncOrderInformation<OCM>;

  private _additionalInfo?: AdditionalInfo<OCM>;

  constructor(
    options: NewebPayPrepareOrderInit<OCM> | NewebPayOrderFromServerInit<OCM>,
    additionalInfo?: AdditionalInfo<OCM>,
  ) {
    this._id = options.id;
    this._items = options.items.map(item => new NewebPayOrderItem(item));
    this._gateway = options.gateway;

    if ('makePayload' in options) {
      this._makePayload = options.makePayload;
      this._createdAt = new Date();
    } else if ('platformTradeNumber' in options) {
      this._platformTradeNumber = options.platformTradeNumber;
      this._createdAt = options.createdAt;
      this._committedAt = options.committedAt;
      this._channel = options.channel;

      this._state = ((status): OrderState => {
        switch (status) {
          case NewebPayOrderStatusFromAPI.INITED:
          case NewebPayOrderStatusFromAPI.WAITING_BANK:
            return OrderState.INITED;

          case NewebPayOrderStatusFromAPI.COMMITTED:
            return OrderState.COMMITTED;

          case NewebPayOrderStatusFromAPI.FAILED:
          case NewebPayOrderStatusFromAPI.CANCELLED:
            return OrderState.FAILED;

          case NewebPayOrderStatusFromAPI.REFUNDED:
            return OrderState.REFUNDED;
        }
      })(options.status);
    }

    this._additionalInfo = additionalInfo;
  }

  get id(): string {
    return this._id;
  }

  get items(): NewebPayOrderItem[] {
    return this._items;
  }

  get totalPrice(): number {
    return this.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
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

  get checkoutURL(): string {
    this._state = OrderState.PRE_COMMIT;

    if (!this._gateway._server) {
      throw new Error('To use automatic checkout server, please initial payment with `withServer` options.');
    }

    return this._gateway.getCheckoutUrl(this);
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

  get failedMessage(): {
    code: string;
    message: string;
  } | null {
    if (this._state !== OrderState.FAILED) return null;

    return {
      code: this._failedCode as string,
      message: this._failedMessage as string,
    };
  }

  // Async order information
  get asyncInfo(): AsyncOrderInformation<OCM> | undefined {
    return this._asyncInfo;
  }

  // Additional information
  get additionalInfo(): AdditionalInfo<OCM> | undefined {
    return this._additionalInfo;
  }

  get platformTradeNumber(): string | null {
    return this._platformTradeNumber;
  }

  get channel(): NewebPaymentChannel | undefined {
    return this._channel;
  }

  fail(returnCode: string, message: string): void {
    this._failedCode = returnCode;
    this._failedMessage = message;

    this._state = OrderState.FAILED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);
  }

  infoRetrieved<T extends OCM = OCM>(asyncInformation: AsyncOrderInformation<T>): void {
    if (this._state !== OrderState.PRE_COMMIT) throw new Error(`Only pre-commit order can commit, now: ${this._state}`);

    this._asyncInfo = asyncInformation;

    this._state = OrderState.ASYNC_INFO_RETRIEVED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_INFO_RETRIEVED, this);
  }

  commit<T extends OCM = OCM>(message: T, additionalInfo?: AdditionalInfo<T>): void {
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

  async creditCardSettle(): Promise<void> {
    if (this._state !== OrderState.COMMITTED) {
      throw new Error('Only committed order can be settled');
    }

    if (this._channel !== NewebPaymentChannel.CREDIT) {
      throw new Error('Only credit card order can be settled');
    }

    await this._gateway.settle(this as NewebPayOrder<NewebPayCreditCardCommitMessage>);

    (
      this.additionalInfo as AdditionalInfo<NewebPayCreditCardCommitMessage> as NewebPayAdditionInfoCreditCard
    ).closeStatus = NewebPayCreditCardBalanceStatus.WAITING;
  }

  async cancelRefund(): Promise<void> {
    await this._gateway.cancelRefund(this as NewebPayOrder<NewebPayCreditCardCommitMessage>);

    (
      this.additionalInfo as AdditionalInfo<NewebPayCreditCardCommitMessage> as NewebPayAdditionInfoCreditCard
    ).refundStatus = NewebPayCreditCardBalanceStatus.UNSETTLED;

    this._state = OrderState.COMMITTED;
  }

  async refund(): Promise<void> {
    if (this._state !== OrderState.COMMITTED) {
      throw new Error('Only committed order can be refunded');
    }

    if (this._channel !== NewebPaymentChannel.CREDIT) {
      throw new Error('Only credit card order can be refunded');
    }

    const closeStatus = (
      this.additionalInfo as AdditionalInfo<NewebPayCreditCardCommitMessage> as NewebPayAdditionInfoCreditCard
    ).closeStatus;

    switch (closeStatus) {
      case NewebPayCreditCardBalanceStatus.UNSETTLED:
        await this._gateway.cancel(this as NewebPayOrder<NewebPayCreditCardCommitMessage>);

        (
          this.additionalInfo as AdditionalInfo<NewebPayCreditCardCommitMessage> as NewebPayAdditionInfoCreditCard
        ).closeStatus = NewebPayCreditCardBalanceStatus.SETTLED;

        this._state = OrderState.REFUNDED;
        break;

      case NewebPayCreditCardBalanceStatus.WAITING:
        await this._gateway.unsettle(this as NewebPayOrder<NewebPayCreditCardCommitMessage>);

        (
          this.additionalInfo as AdditionalInfo<NewebPayCreditCardCommitMessage> as NewebPayAdditionInfoCreditCard
        ).closeStatus = NewebPayCreditCardBalanceStatus.UNSETTLED;

        this._state = OrderState.REFUNDED;
        break;

      case NewebPayCreditCardBalanceStatus.WORKING:
      case NewebPayCreditCardBalanceStatus.SETTLED:
        await this._gateway.refund(this as NewebPayOrder<NewebPayCreditCardCommitMessage>);

        (
          this.additionalInfo as AdditionalInfo<NewebPayCreditCardCommitMessage> as NewebPayAdditionInfoCreditCard
        ).closeStatus = NewebPayCreditCardBalanceStatus.SETTLED;

        (
          this.additionalInfo as AdditionalInfo<NewebPayCreditCardCommitMessage> as NewebPayAdditionInfoCreditCard
        ).refundStatus = NewebPayCreditCardBalanceStatus.WAITING;

        this._state = OrderState.REFUNDED;
        break;
    }
  }
}
