import { Logger, NotImplementedException } from '@nestjs/common';
import {
  AdditionalInfo,
  AsyncOrderInformation,
  CardType,
  CreditCardAuthInfo,
  Order,
  OrderFailMessage,
  OrderState,
  PaymentEvents,
  PaymentItem,
} from '@rytass/payments';
import { CTBCPayment } from './ctbc-payment';
import { posApiCancelRefund, posApiRefund } from './ctbc-pos-api-utils';
import {
  CTBCCheckoutWithBoundCardRequestPayload,
  CTBCOrderCommitMessage,
  CTBCPayOrderForm,
  CTBCPosApiCancelRefundParams,
  CTBCPosApiConfig,
  CTBCPosApiRefundParams,
  OrderCreateInit
} from './typings';

export class CTBCOrder<
  OCM extends CTBCOrderCommitMessage = CTBCOrderCommitMessage,
> implements Order<OCM> {
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
  private _cardType: CardType;

  // POS API 相關資訊，用於後續操作（如退款）
  private _xid: string | undefined;

  private readonly logger = new Logger(CTBCOrder.name);

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
    this._cardType = options.cardType ?? CardType.VMJ;
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

  get cardType(): CardType {
    return this._cardType;
  }

  get xid(): string | undefined {
    return this._xid;
  }

  // 設定 POS API 相關資訊（通常在交易成功後調用）
  setPosApiInfo(xid?: string): void {
    if (xid) this._xid = xid;
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

  async refund(amount?: number): Promise<void> {
    if (this._state !== OrderState.COMMITTED) {
      throw new Error('Only committed orders can be refunded');
    }

    // 計算退款金額
    const totalAmount = this._items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const refundAmount = amount ?? totalAmount;

    if (refundAmount > totalAmount) {
      throw new Error('Refund amount cannot exceed original amount');
    }

    const isAmex = this._cardType === CardType.AE;

    if (isAmex) {

      throw new NotImplementedException('AMEX refund is not implemented');
      // // 使用 AMEX SOAP API 退款
      // const amexRefundParams: CTBCAmexRefundParams = {
      //   merId: this._gateway.merId,
      //   xid: this._id, // 假設使用訂單ID作為交易ID
      //   lidm: this._id,
      //   credAmt: refundAmount,
      //   IN_MAC_KEY: this._gateway.amexApiMacKey!,
      // };

      // const result = await amexRefund(this._gateway.amexApiConfig!, amexRefundParams);

      // if (result.errCode !== '00') {
      //   this._state = OrderState.FAILED;
      //   this._failedCode = result.errCode;
      //   this._failedMessage = result.errDesc || 'AMEX refund failed';

      //   throw new Error(this._failedMessage);
      // }

      // // AMEX 退款成功
      // this._state = OrderState.REFUNDED;
    } else {
      // 使用 POS API 退款 - 直接使用已保存的 XID 和 AuthCode
      const posApiConfig: CTBCPosApiConfig = {
        URL: this._gateway.baseUrl,
        MacKey: this._gateway.txnKey,
      };

      // 檢查是否有必要的 XID 和 AuthCode
      if (!this._xid || !this._additionalInfo) {
        this._state = OrderState.FAILED;
        this._failedMessage = 'Missing XID or AuthCode for refund operation. Please ensure the order was properly committed with POS API information.';
        throw new Error(this._failedMessage);
      }

      try {
        // 執行退款

        const authCode = (this.additionalInfo as CreditCardAuthInfo).authCode
        const refundParams: CTBCPosApiRefundParams = {
          MERID: this._gateway.merId,
          'LID-M': this._id,
          OrgAmt: totalAmount.toString(),
          AuthCode: authCode,
          XID: this._xid,
          currency: '901', // NTD
          PurchAmt: refundAmount.toString(),
          exponent: '0',
        };


        this.logger.log(`執行 POS API 退款: XID=${this._xid}, AuthCode=${authCode}, 退款金額=${refundAmount}`);

        // 執行退款
        const refundResult = await posApiRefund(posApiConfig, refundParams);

        if (typeof refundResult === 'number') {
          this._state = OrderState.FAILED;
          this._failedCode = refundResult.toString();
          this._failedMessage = `Refund failed with error code: ${refundResult}`;
          throw new Error(this._failedMessage);
        }

        // 檢查退款結果
        if (refundResult.RespCode === '0') {
          // 退款成功
          this._state = OrderState.REFUNDED;
        } else {
          // 其他錯誤情況
          this._state = OrderState.FAILED;
          this._failedCode = refundResult.RespCode;
          this._failedMessage = refundResult.ERRDESC || refundResult.ErrorDesc || 'Refund failed';
          throw new Error(this._failedMessage);
        }

      } catch (error) {
        // 如果還沒有設定失敗狀態，在這裡設定
        if (this._state !== OrderState.FAILED) {
          this._state = OrderState.FAILED;
          if (error instanceof Error) {
            this._failedMessage = error.message;
          } else {
            this._failedMessage = 'Unknown refund error';
          }
        }
        throw error;
      }
    }
  }

  async cancelRefund(amount: number): Promise<void> {
    // 只有已提交的訂單才能進行退款撤銷操作
    // 不需要限制必須是 REFUNDED 狀態，因為部分退款的訂單狀態仍然是 COMMITTED
    if (this._state !== OrderState.COMMITTED && this._state !== OrderState.REFUNDED) {
      throw new Error('Only committed or refunded orders can have their refund cancelled');
    }

    // 計算退款撤銷金額
    const totalAmount = this._items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const cancelRefundAmount = amount;

    if (cancelRefundAmount > totalAmount) {
      throw new Error('Cancel refund amount cannot exceed original amount');
    }

    const isAmex = this._cardType === CardType.AE;

    if (isAmex) {
      throw new NotImplementedException('AMEX cancel refund is not implemented');

    } else {
      const posApiConfig: CTBCPosApiConfig = {
        URL: this._gateway.baseUrl,
        MacKey: this._gateway.txnKey,
      };

      // 檢查是否有必要的 XID 和 AuthCode
      if (!this._xid || !this._additionalInfo) {
        this._state = OrderState.FAILED;
        this._failedMessage = 'Missing XID or AuthCode for refund cancellation operation. Please ensure the order was properly committed with POS API information.';
        throw new Error(this._failedMessage);
      }

      try {
        const authCode = (this.additionalInfo as CreditCardAuthInfo).authCode;
        const cancelRefundParams: CTBCPosApiCancelRefundParams = {
          MERID: this._gateway.merId,
          'LID-M': this._id,
          CredRevAmt: cancelRefundAmount.toString(),
          AuthCode: authCode,
          XID: this._xid,
          currency: '901', // NTD
          exponent: '0',
        };


        this.logger.log(`執行 POS API 退款撤銷: XID=${this._xid}, AuthCode=${authCode}, 撤銷金額=${cancelRefundAmount}`);

        // 執行退款撤銷
        const cancelRefundResult = await posApiCancelRefund(posApiConfig, cancelRefundParams);

        if (typeof cancelRefundResult === 'number') {
          this._state = OrderState.FAILED;
          this._failedCode = cancelRefundResult.toString();
          this._failedMessage = `Cancel refund failed with error code: ${cancelRefundResult}`;
          throw new Error(this._failedMessage);
        }

        // 檢查退款撤銷結果
        if (cancelRefundResult.RespCode === '0') {
          // 退款撤銷成功，將狀態變回 COMMITTED
          this._state = OrderState.COMMITTED;
        } else {
          // 其他錯誤情況
          this._state = OrderState.FAILED;
          this._failedCode = cancelRefundResult.RespCode;
          this._failedMessage = cancelRefundResult.ERRDESC || cancelRefundResult.ErrorDesc || 'Cancel refund failed';
          throw new Error(this._failedMessage);
        }

      } catch (error) {
        // 如果還沒有設定失敗狀態，在這裡設定
        if (this._state !== OrderState.FAILED) {
          this._state = OrderState.FAILED;
          if (error instanceof Error) {
            this._failedMessage = error.message;
          } else {
            this._failedMessage = 'Unknown cancel refund error';
          }
        }
        throw error;
      }
    }
  }
}
