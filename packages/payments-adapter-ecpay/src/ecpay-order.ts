import { AdditionalInfo, AsyncOrderInformation, Channel, Order, OrderFailMessage, OrderState, PaymentEvents } from '@rytass/payments';
import { ECPayPayment, ECPayOrderItem, ECPayCallbackPaymentType, ECPayCommitMessage, ECPayOrderForm, ECPayQueryResultStatus, OrderCreateInit, OrderFromServerInit } from '.';
import { ECPayChannel } from './constants';

export class ECPayOrder<OCM extends ECPayCommitMessage> implements Order<OCM> {
  static FAKE_ITEM = 'RP_FAKE_ITEM';

  private readonly _id: string;

  private readonly _items: ECPayOrderItem[];

  private readonly _form: ECPayOrderForm | undefined;

  private readonly gateway: ECPayPayment<OCM>;

  private _asyncInfo?: AsyncOrderInformation<OCM>;

  private _additionalInfo?: AdditionalInfo<OCM>;

  private _committedAt: Date | null = null;

  private _createdAt: Date | null = null;

  private _platformTradeNumber: string | null = null;

  private _state: OrderState;

  private _paymentType: ECPayCallbackPaymentType | undefined;

  private _failedCode: number | undefined;

  private _failedMessage: string | undefined;

  constructor(options: OrderCreateInit<OCM> | OrderFromServerInit<OCM>) {
    this._id = options.id;
    this._items = options.items.map(item => new ECPayOrderItem(item));
    this.gateway = options.gateway;
    this._state = OrderState.INITED;

    if ((options as OrderCreateInit<OCM>).form) {
      this._form = (options as OrderCreateInit<OCM>).form;
      this._paymentType = (() => {
        switch ((options as OrderCreateInit<OCM>).form.ChoosePayment) {
          case ECPayChannel[Channel.CREDIT_CARD]:
            return ECPayCallbackPaymentType.CREDIT_CARD;

          case ECPayChannel[Channel.VIRTUAL_ACCOUNT]:
            return ECPayCallbackPaymentType.VIRTUAL_ACCOUNT_WAITING;

          default:
            return undefined;
        }
      })();
    } else if ((options as OrderFromServerInit<OCM>).platformTradeNumber) {
      this._createdAt = (options as OrderFromServerInit<OCM>).createdAt;
      this._committedAt = (options as OrderFromServerInit<OCM>).committedAt;
      this._platformTradeNumber = (options as OrderFromServerInit<OCM>).platformTradeNumber;
      this._paymentType = (options as OrderFromServerInit<OCM>).paymentType;
      this._state = (() => {
        switch ((options as OrderFromServerInit<OCM>).status) {
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
    <form action="${this.gateway.baseUrl}/Cashier/AioCheckOut/V5" method="POST">
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

    if (!this.gateway._server) {
      throw new Error('To use automatic checkout server, please initial payment with `withServer` options.');
    }

    return this.gateway.getCheckoutUrl(this);
  }

  get commitable(): boolean {
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
      code: this._failedCode as number,
      message: this._failedMessage as string,
    };
  }

  infoRetrieved<T extends OCM>(asyncInformation: AsyncOrderInformation<T>, paymentType?: ECPayCallbackPaymentType) {
    if (this._state !== OrderState.PRE_COMMIT) throw new Error(`Only pre-commit order can commit, now: ${this._state}`);

    this._asyncInfo = asyncInformation;
    this._paymentType = paymentType || this._paymentType;

    this._state = OrderState.ASYNC_INFO_RETRIEVED;

    this.gateway.emitter.emit(PaymentEvents.ORDER_INFO_RETRIEVED, this);
  }

  fail(returnCode: number, message: string) {
    this._failedCode = returnCode;
    this._failedMessage = message;

    this._state = OrderState.FAILED;
  }

  commit<T extends OCM>(message: T, additionalInfo?: AdditionalInfo<T>) {
    if (!this.commitable) throw new Error(`Only pre-commit, info-retrieved order can commit, now: ${this._state}`);

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

    this.gateway.emitter.emit(PaymentEvents.ORDER_COMMITTED, this);
  }
}

