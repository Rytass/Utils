import { AdditionalInfo, AsyncOrderInformation, Channel, CreditCardAuthInfo, Order, OrderFailMessage, OrderState, PaymentEvents } from '@rytass/payments';
import { ECPayPayment, ECPayOrderItem, ECPayCallbackPaymentType, ECPayCommitMessage, ECPayOrderForm, ECPayQueryResultStatus, OrderCreateInit, OrderFromServerInit } from '.';
import { ECPayChannel } from './constants';
import { ECPayCreditCardOrderStatus } from './typings';

export class ECPayOrder<OCM extends ECPayCommitMessage> implements Order<OCM> {
  private readonly _id: string;

  private readonly _items: ECPayOrderItem[];

  private readonly _form: ECPayOrderForm | undefined;

  private readonly _gateway: ECPayPayment<OCM>;

  private _asyncInfo?: AsyncOrderInformation<OCM>;

  private _additionalInfo?: AdditionalInfo<OCM>;

  private _committedAt: Date | null = null;

  private _createdAt: Date | null = null;

  private _platformTradeNumber: string | null = null;

  private _state: OrderState;

  private _paymentType: ECPayCallbackPaymentType | undefined;

  private _failedCode: string | undefined;

  private _failedMessage: string | undefined;

  constructor(options: OrderCreateInit<OCM> | OrderFromServerInit<OCM>, additionalInfo?: AdditionalInfo<OCM>) {
    this._id = options.id;
    this._items = options.items.map(item => new ECPayOrderItem(item));
    this._gateway = options.gateway;
    this._state = OrderState.INITED;

    if ('form' in options) {
      this._form = options.form;
      this._paymentType = (() => {
        switch (options.form.ChoosePayment) {
          case ECPayChannel[Channel.CREDIT_CARD]:
            return ECPayCallbackPaymentType.CREDIT_CARD;

          case ECPayChannel[Channel.VIRTUAL_ACCOUNT]:
            return ECPayCallbackPaymentType.VIRTUAL_ACCOUNT_WAITING;

          default:
            return undefined;
        }
      })();
    } else if ('platformTradeNumber' in options) {
      this._createdAt = options.createdAt;
      this._committedAt = options.committedAt;
      this._platformTradeNumber = options.platformTradeNumber;
      this._paymentType = options.paymentType;
      this._state = (() => {
        switch (options.status) {
          case ECPayQueryResultStatus.COMMITTED:
            return OrderState.COMMITTED;

          case ECPayQueryResultStatus.FAILED:
            return OrderState.FAILED;

          case ECPayQueryResultStatus.PRE_COMMIT:
            return OrderState.PRE_COMMIT;

          default:
            return OrderState.INITED;
        }
      })();
    }

    this._additionalInfo = additionalInfo;
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

  get form(): ECPayOrderForm {
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
    <form action="${this._gateway.baseUrl}/Cashier/AioCheckOut/V5" method="POST">
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

  get committable(): boolean {
    return !!~[OrderState.PRE_COMMIT, OrderState.ASYNC_INFO_RETRIEVED].indexOf(this._state);
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

  get platformTradeNumber(): string | null {
    return this._platformTradeNumber;
  }

  get paymentType(): ECPayCallbackPaymentType | undefined {
    return this._paymentType;
  }

  // Async order infomation
  get asyncInfo() {
    return this._asyncInfo;
  }

  // Additional infomation
  get additionalInfo() {
    return this._additionalInfo;
  }

  get failedMessage() {
    if (this._state !== OrderState.FAILED) return null;

    return {
      code: this._failedCode as string,
      message: this._failedMessage as string,
    };
  }

  infoRetrieved<T extends OCM>(asyncInformation: AsyncOrderInformation<T>, paymentType?: ECPayCallbackPaymentType) {
    if (this._state !== OrderState.PRE_COMMIT) throw new Error(`Only pre-commit order can commit, now: ${this._state}`);

    this._asyncInfo = asyncInformation;
    this._paymentType = paymentType || this._paymentType;

    this._state = OrderState.ASYNC_INFO_RETRIEVED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_INFO_RETRIEVED, this);
  }

  fail(returnCode: string, message: string) {
    this._failedCode = returnCode;
    this._failedMessage = message;

    this._state = OrderState.FAILED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_FAILED, this);
  }

  commit<T extends OCM>(message: T, additionalInfo?: AdditionalInfo<T>) {
    if (!this.committable) throw new Error(`Only pre-commit, info-retrieved order can commit, now: ${this._state}`);

    if (this._id !== message.id) {
      throw new Error(`Order ID not matched, given: ${message.id} actual: ${this._id}`);
    }

    if (this._form!.MerchantID !== message.merchantId) {
      throw new Error(`Merchant ID not matched, given: ${message.merchantId} actual: ${this._form!.MerchantID}`);
    }

    if (Number(this._form!.TotalAmount) !== message.totalPrice) {
      throw new Error(`Total amount not matched, given: ${message.totalPrice} actual: ${this._form!.TotalAmount}`);
    }

    this._additionalInfo = additionalInfo;
    this._committedAt = message.committedAt;
    this._createdAt = message.tradeDate;
    this._platformTradeNumber = message.tradeNumber;
    this._paymentType = message.paymentType;
    this._state = OrderState.COMMITTED;

    this._gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);
  }

  async refund(amount?: number): Promise<void> {
    if (this._state !== OrderState.COMMITTED) {
      throw new Error('Only committed order can be refunded');
    }

    if (this._paymentType !== ECPayCallbackPaymentType.CREDIT_CARD) {
      throw new Error('Only credit card payment can be refunded');
    }

    if (!(this._additionalInfo as CreditCardAuthInfo)?.gwsr) {
      throw new Error('Cannot fetch gwsr from ECPay');
    }

    const creditCardStatus = await this._gateway.getCreditCardTradeStatus((this._additionalInfo as CreditCardAuthInfo).gwsr!, amount || this.totalPrice);

    const refundAction = (() => {
      switch (creditCardStatus) {
        case ECPayCreditCardOrderStatus.CLOSED:
          return 'R';

        case ECPayCreditCardOrderStatus.AUTHORIZED:
          return 'N';

        case ECPayCreditCardOrderStatus.UNAUTHORIZED:
          throw new Error('Unauthorized order cannot be refunded');

        case ECPayCreditCardOrderStatus.CANCELLED:
        case ECPayCreditCardOrderStatus.MANUALLY_CANCELLED:
          throw new Error('Order already cancelled');
      }
    })();

    await this._gateway.doOrderAction(this, refundAction, amount || this.totalPrice);

    this._state = OrderState.REFUNDED;
  }
}

