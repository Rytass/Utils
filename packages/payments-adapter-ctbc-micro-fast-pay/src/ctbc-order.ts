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
import { CTBCPayment, debugPayment } from './ctbc-payment';
import { posApiCancelRefund, posApiSmartCancelOrRefund } from './ctbc-pos-api-utils';
import { amexCancelRefund, amexSmartCancelOrRefund } from './ctbc-amex-api-utils';
import type { CTBCAmexCancelRefundParams, CTBCAmexConfig, CTBCAmexRefundParams } from './typings';
import {
  CTBCCheckoutWithBoundCardRequestPayload,
  CTBCOrderCommitMessage,
  CTBCPayOrderForm,
  CTBCPosApiCancelRefundParams,
  CTBCPosApiConfig,
  CTBCPosApiRefundParams,
  OrderCreateInit,
} from './typings';

export type AmexCreditCardAuthInfo = CreditCardAuthInfo & {
  capBatchId?: string;
  capBatchSeq?: string;
};

export class CTBCOrder<OCM extends CTBCOrderCommitMessage = CTBCOrderCommitMessage> implements Order<OCM> {
  private readonly _id: string;
  private readonly _items: PaymentItem[];
  private readonly _form: CTBCPayOrderForm | undefined;
  private readonly _gateway: CTBCPayment<OCM>;

  private _additionalInfo?: AdditionalInfo<OCM>;
  private _asyncInfo?: AsyncOrderInformation<OCM>;
  private _committedAt: Date | null = null;
  private readonly _createdAt: Date | null = null;
  private _state: OrderState;
  private _failedCode: string | undefined;
  private _failedMessage: string | undefined;
  private readonly _clientBackUrl: string | undefined;

  private readonly _checkoutMemberId: string | null = null;
  private readonly _checkoutCardId: string | null = null;
  private readonly _cardType: CardType;

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
    return this.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
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
        .map(([key, value]) => `<input name="${key}" value="${value}" type="hidden" />`)
        .join('\n')}
    </form>
    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>`;
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
      throw new Error('Bound card checkout payload requires checkoutCardId and checkoutMemberId');
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
          .map(item => item.name)
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
      // AE: 使用智慧流程自動判斷 AuthRev / CapRev / Refund
      try {
        const base = new URL(this._gateway.baseUrl);
        const host = base.hostname;
        const port = base.port ? parseInt(base.port, 10) : base.protocol === 'https:' ? 443 : 80;
        const wsdlUrl = `${base.protocol}//${host}${port && ![80, 443].includes(port) ? `:${port}` : ''}/HubAgentConsole/services/AEPaymentSoap?wsdl`;

        const amexConfig: CTBCAmexConfig = {
          host,
          port,
          wsdlUrl,
        };

        const amexParams: CTBCAmexRefundParams = {
          merId: this._gateway.merId,
          xid: (this.additionalInfo as CreditCardAuthInfo).xid as string,
          lidm: this._id,
          orgAmt: totalAmount,
          purchAmt: refundAmount,
          IN_MAC_KEY: this._gateway.txnKey,
        };

        const { action, response } = await amexSmartCancelOrRefund(amexConfig, amexParams);

        debugPayment(`AMEX flow action=${action}, result=${JSON.stringify(response)}`);

        if (response.RespCode === '0') {
          // 視為財務已回復（取消或退款成功）
          this._state = OrderState.REFUNDED;

          const capBatchId = response.capBatchId;
          const capBatchSeq = response.capBatchSeq;

          if (capBatchId && capBatchSeq && this._additionalInfo) {
            const updatedInfo: AmexCreditCardAuthInfo = {
              ...(this._additionalInfo as CreditCardAuthInfo),
              capBatchId,
              capBatchSeq,
            };

            this._additionalInfo = updatedInfo as AdditionalInfo<OCM>;
          }
        } else {
          this._state = OrderState.FAILED;
          this._failedCode = response.ErrCode ?? response.RespCode;
          this._failedMessage = response.ERRDESC || 'AMEX refund/cancel flow failed';
          throw new Error(this._failedMessage);
        }
      } catch (error) {
        if (this._state !== OrderState.FAILED) {
          this._state = OrderState.FAILED;
          this._failedMessage = error instanceof Error ? error.message : 'Unknown AMEX refund error';
        }

        throw error;
      }
    } else {
      // 使用 POS API 智慧取消/退款（AuthRev / CapRev / Refund）
      const posApiConfig: CTBCPosApiConfig = {
        URL: this._gateway.baseUrl,
        MacKey: this._gateway.txnKey,
      };

      // 檢查是否有必要的 XID 和 AuthCode
      if (!(this.additionalInfo as CreditCardAuthInfo).xid && !(this.additionalInfo as CreditCardAuthInfo).authCode) {
        this._state = OrderState.FAILED;
        this._failedMessage =
          'Missing XID or AuthCode for refund operation. Please ensure the order was properly committed with information.';

        throw new Error(this._failedMessage);
      }

      try {
        const xid = (this.additionalInfo as CreditCardAuthInfo).xid;
        const authCode = (this.additionalInfo as CreditCardAuthInfo).authCode;
        const refundParams: CTBCPosApiRefundParams = {
          MERID: this._gateway.merId,
          'LID-M': this._id,
          OrgAmt: totalAmount.toString(),
          AuthCode: authCode,
          XID: xid || '',
          currency: '901', // NTD
          PurchAmt: refundAmount.toString(),
          exponent: '0',
        };

        debugPayment(`執行 POS 智慧取消/退款: XID=${xid}, AuthCode=${authCode}, 金額=${refundAmount}`);

        // 智慧流程：查詢 → 決策 → AuthRev/CapRev/Refund
        const { action, response } = await posApiSmartCancelOrRefund(posApiConfig, refundParams);

        debugPayment(`POS flow action=${action}, result=${JSON.stringify(response)}`);

        if (typeof response === 'number') {
          this._state = OrderState.FAILED;
          this._failedCode = response.toString();
          this._failedMessage = `Refund/Cancel failed with error code: ${response}`;
          throw new Error(this._failedMessage);
        }

        // 成功（RespCode === '0'）視為金流已回復（取消或退款）
        if (response.RespCode === '0') {
          this._state = OrderState.REFUNDED;
        } else {
          // 其他錯誤情況
          this._state = OrderState.FAILED;
          this._failedCode = response.RespCode;
          this._failedMessage = response.ERRDESC || response.ErrorDesc || 'Refund/Cancel failed';
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

  async cancelRefund(
    amount: number,
    amexCancelArgs?: {
      capBatchId: string;
      capBatchSeq: string;
    },
  ): Promise<void> {
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
      if (!this._additionalInfo || !amexCancelArgs) {
        this._state = OrderState.FAILED;
        this._failedMessage =
          'Missing refund metadata for AMEX cancel refund. Please ensure the order was refunded via AMEX flow.';

        throw new Error(this._failedMessage);
      }

      const amexInfo = this._additionalInfo as AmexCreditCardAuthInfo;
      const xid = amexInfo.xid;
      const capBatchId = amexInfo.capBatchId || amexCancelArgs?.capBatchId;
      const capBatchSeq = amexInfo.capBatchSeq || amexCancelArgs?.capBatchSeq;

      if (!xid || !capBatchId || !capBatchSeq) {
        this._state = OrderState.FAILED;
        this._failedMessage =
          'Missing XID, capBatchId or capBatchSeq for AMEX cancel refund. Please ensure prior AMEX refund was successful.';

        throw new Error(this._failedMessage);
      }

      try {
        const base = new URL(this._gateway.baseUrl);
        const host = base.hostname;
        const port = base.port ? parseInt(base.port, 10) : base.protocol === 'https:' ? 443 : 80;
        const wsdlUrl = `${base.protocol}//${host}${port && ![80, 443].includes(port) ? `:${port}` : ''}/HubAgentConsole/services/AEPaymentSoap?wsdl`;

        const amexConfig: CTBCAmexConfig = {
          host,
          port,
          wsdlUrl,
        };

        const cancelParams: CTBCAmexCancelRefundParams = {
          merId: this._gateway.merId,
          lidm: this._id,
          xid,
          capBatchId,
          capBatchSeq,
          IN_MAC_KEY: this._gateway.txnKey,
        };

        debugPayment(
          `執行 AMEX 退款撤銷: XID=${xid}, capBatchId=${capBatchId}, capBatchSeq=${capBatchSeq}, 撤銷金額=${cancelRefundAmount}`,
        );

        const cancelResponse = await amexCancelRefund(amexConfig, cancelParams);

        debugPayment(`AMEX cancel refund result=${JSON.stringify(cancelResponse)}`);

        if (cancelResponse.RespCode === '0') {
          this._state = OrderState.COMMITTED;

          const { capBatchId, capBatchSeq, ...restInfo } = amexInfo;

          this._additionalInfo = restInfo as AdditionalInfo<OCM>;
        } else {
          this._state = OrderState.FAILED;
          this._failedCode = cancelResponse.ErrCode ?? cancelResponse.RespCode;
          this._failedMessage = cancelResponse.ERRDESC || 'AMEX cancel refund failed';
          throw new Error(this._failedMessage);
        }
      } catch (error) {
        if (this._state !== OrderState.FAILED) {
          this._state = OrderState.FAILED;
          this._failedMessage = error instanceof Error ? error.message : 'Unknown AMEX cancel refund error';
        }

        throw error;
      }
    } else {
      const posApiConfig: CTBCPosApiConfig = {
        URL: this._gateway.baseUrl,
        MacKey: this._gateway.txnKey,
      };

      // 檢查是否有必要的 XID 和 AuthCode
      if (!this._additionalInfo) {
        this._state = OrderState.FAILED;
        this._failedMessage =
          'Missing XID or AuthCode for refund cancellation operation. Please ensure the order was properly committed with POS API information.';

        throw new Error(this._failedMessage);
      }

      try {
        const xid = (this.additionalInfo as CreditCardAuthInfo).xid;
        const authCode = (this.additionalInfo as CreditCardAuthInfo).authCode;

        const cancelRefundParams: CTBCPosApiCancelRefundParams = {
          MERID: this._gateway.merId,
          'LID-M': this._id,
          CredRevAmt: cancelRefundAmount.toString(),
          AuthCode: authCode,
          XID: xid || '',
          currency: '901', // NTD
          exponent: '0',
        };

        debugPayment(`執行 POS API 退款撤銷: XID=${xid}, AuthCode=${authCode}, 撤銷金額=${cancelRefundAmount}`);

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
