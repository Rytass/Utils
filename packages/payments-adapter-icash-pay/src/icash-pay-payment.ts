import { PaymentGateway } from '@rytass/payments';
import { EventEmitter } from 'node:events';
import {
  createCipheriv,
  randomBytes,
  sign,
  verify,
  createDecipheriv,
} from 'node:crypto';
import {
  I_CASH_PAY_SUCCESS_CODE,
  ICashPayAESKey,
  ICashPayBaseUrls,
  ICashPayCommitMessage,
  ICashPayDeductRequestPayloadBody,
  ICashPayDeductResponsePayloadBody,
  ICashPayPaymentInitOptions,
  ICashPayPrepareOptions,
  ICashPayQueryRequestPayloadBody,
  ICashPayQueryResponsePayloadBody,
  ICashPayRefundOptions,
  ICashPayRefundRequestPayloadBody,
  ICashPayResponse,
  ICashPayTradeStatus,
} from './typing';
import { ICashPayOrder } from './icash-pay-order';
import { DateTime } from 'luxon';
import axios from 'axios';

export class ICashPayPayment<
  CM extends ICashPayCommitMessage = ICashPayCommitMessage,
> implements PaymentGateway<CM, ICashPayOrder<CM>>
{
  readonly emitter = new EventEmitter();

  private readonly baseUrl: ICashPayBaseUrls;
  private readonly merchantId: string;
  private readonly clientPrivateKey: string;
  private readonly serverPublicKey: string;
  private readonly aesKey: ICashPayAESKey;

  constructor(options: ICashPayPaymentInitOptions) {
    this.baseUrl = options.baseUrl;
    this.merchantId = options.merchantId;
    this.clientPrivateKey = options.clientPrivateKey;
    this.serverPublicKey = options.serverPublicKey;
    this.aesKey = options.aesKey;
  }

  private getOrderId() {
    return randomBytes(10).toString('hex');
  }

  private encrypt(data: string): string {
    const cipher = createCipheriv(
      'aes-256-cbc',
      this.aesKey.key,
      this.aesKey.iv,
    );

    return Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]).toString('base64');
  }

  private decrypt<T>(data: string): T {
    const decipher = createDecipheriv(
      'aes-256-cbc',
      this.aesKey.key,
      this.aesKey.iv,
    );

    return JSON.parse(
      `${decipher.update(data, 'base64').toString('utf8')}${decipher.final('utf8')}`,
    );
  }

  private signature(data: string): string {
    return sign(
      'RSA-SHA256',
      Buffer.from(data, 'utf8'),
      this.clientPrivateKey,
    ).toString('base64');
  }

  private verify(data: string, signature: string): boolean {
    return verify(
      'RSA-SHA256',
      Buffer.from(data, 'utf8'),
      this.serverPublicKey,
      Buffer.from(signature, 'base64'),
    );
  }

  async prepare<OCM extends CM = CM>(
    options: ICashPayPrepareOptions,
  ): Promise<ICashPayOrder<OCM>> {
    const id = options.id ?? this.getOrderId();
    const totalPrice = options.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    const totalAmount =
      options.amount +
      (options.collectedAmount ?? 0) +
      (options.consignmentAmount ?? 0);

    if (totalPrice !== totalAmount) {
      throw new Error('Total amount does not match the sum of item prices');
    }

    if (totalAmount <= 0) {
      throw new Error('Total amount must be greater than 0');
    }

    const now = DateTime.now();

    const payload: ICashPayDeductRequestPayloadBody = {
      PlatformID: this.merchantId,
      MerchantID: this.merchantId,
      MerchantTradeNo: id,
      StoreName: options.storeName,
      MerchantTradeDate: now.toFormat('yyyy/MM/dd HH:mm:ss'),
      TotalAmount: Math.round(totalAmount * 100).toString(),
      ItemAmt: Math.round(options.amount * 100).toString(),
      UtilityAmt: Math.round(options.collectedAmount ?? 0).toString(),
      CommAmt: Math.round(options.consignmentAmount ?? 0).toString(),
      ItemNonRedeemAmt: Math.round(options.nonRedeemAmount ?? 0).toString(),
      UtilityNonRedeemAmt: Math.round(
        options.collectedNonRedeemAmount ?? 0,
      ).toString(),
      CommNonRedeemAmt: Math.round(
        options.consignmentNonRedeemAmount ?? 0,
      ).toString(),
      NonPointAmt: Math.round(options.nonPointAmount ?? 0).toString(),
      Item: null,
      Barcode: options.barcode,
    };

    const encData = this.encrypt(JSON.stringify(payload));

    return new ICashPayOrder({
      id,
      items: options.items,
      gateway: this,
      createdAt: now.toJSDate(),
      deductEncData: encData,
      isTWQRCode: false,
      isRefunded: false,
    });
  }

  async commit(encData: string): Promise<ICashPayDeductResponsePayloadBody> {
    const formData = new FormData();

    formData.append('EncData', encData);

    const { data, headers } = await axios.post<ICashPayResponse>(
      `${this.baseUrl}/POS/DeductICPOF`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-iCP-EncKeyID': this.aesKey.id,
          'X-iCP-Signature': this.signature(encData),
        },
      },
    );

    if (data.RtnCode !== I_CASH_PAY_SUCCESS_CODE) {
      throw new Error(`[${data.RtnCode}] ${data.RtnMsg}`);
    }

    const signature = headers['x-icp-signature'] ?? '';

    const verified = this.verify(JSON.stringify(data), signature);

    if (!verified) {
      throw new Error('[-999] Signature verification failed');
    }

    const responsePayload = this.decrypt<ICashPayDeductResponsePayloadBody>(
      data.EncData,
    );

    return responsePayload;
  }

  async query<O extends ICashPayOrder<CM> = ICashPayOrder<CM>>(
    id: string,
  ): Promise<O> {
    const payload: ICashPayQueryRequestPayloadBody = {
      MerchantID: this.merchantId,
      MerchantTradeNo: id,
    };

    const encData = this.encrypt(JSON.stringify(payload));

    const formData = new FormData();

    formData.append('EncData', encData);

    const { data, headers } = await axios.post<ICashPayResponse>(
      `${this.baseUrl}/Cashier/QueryTradeICPO`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-iCP-EncKeyID': this.aesKey.id,
          'X-iCP-Signature': this.signature(encData),
        },
      },
    );

    const now = DateTime.now();

    if (data.RtnCode !== I_CASH_PAY_SUCCESS_CODE) {
      return new ICashPayOrder<CM>({
        id,
        items: [],
        gateway: this,
        createdAt: now.toJSDate(),
        committedAt: null,
        failedCode: data.RtnCode.toString(),
        failedMessage: data.RtnMsg,
        isTWQRCode: false,
        isRefunded: false,
      }) as O;
    }

    const signature = headers['x-icp-signature'] ?? '';

    const verified = this.verify(JSON.stringify(data), signature);

    if (!verified) {
      return new ICashPayOrder<CM>({
        id,
        items: [],
        gateway: this,
        createdAt: now.toJSDate(),
        committedAt: null,
        failedCode: '-999',
        failedMessage: 'Signature verification failed',
        isTWQRCode: false,
        isRefunded: false,
      }) as O;
    }

    const responsePayload = this.decrypt<ICashPayQueryResponsePayloadBody>(
      data.EncData,
    );

    if (
      ~[
        ICashPayTradeStatus.FAILED,
        ICashPayTradeStatus.CANCELLED,
        ICashPayTradeStatus.SETTLEMENT_FAILED,
        ICashPayTradeStatus.INITED,
      ].indexOf(responsePayload.TradeStatus)
    ) {
      return new ICashPayOrder<CM>({
        id,
        items: [],
        gateway: this,
        createdAt: now.toJSDate(),
        committedAt: null,
        failedCode: data.RtnCode.toString(),
        failedMessage: data.RtnMsg,
        isTWQRCode: responsePayload.IsFiscTWQC === 1,
        isRefunded: false,
      }) as O;
    }

    return new ICashPayOrder({
      id,
      items: [
        ...(responsePayload.TotalAmount || responsePayload.OTotalAmount
          ? [
              {
                name: '服務費',
                quantity: 1,
                unitPrice:
                  Number(
                    responsePayload.TotalAmount ??
                      responsePayload.OTotalAmount ??
                      '0',
                  ) / 100,
              },
            ]
          : []),
      ],
      gateway: this,
      createdAt: DateTime.fromFormat(
        responsePayload.PaymentDate,
        'yyyy/MM/dd HH:mm:ss',
      ).toJSDate(),
      committedAt: DateTime.fromFormat(
        responsePayload.PaymentDate,
        'yyyy/MM/dd HH:mm:ss',
      ).toJSDate(),
      transactionId: responsePayload.TransactionID,
      icpAccount: responsePayload.ICPAccount,
      paymentType: responsePayload.PaymentType,
      boundMemberId: responsePayload.MMemberID || undefined,
      invoiceMobileCarrier: responsePayload.MobileInvoiceCarry || undefined,
      creditCardFirstSix: responsePayload.MaskedPan
        ? responsePayload.MaskedPan.slice(0, 6)
        : undefined,
      creditCardLastFour: responsePayload.MaskedPan
        ? responsePayload.MaskedPan.slice(-4)
        : undefined,
      isTWQRCode: responsePayload.IsFiscTWQC === 1,
      twqrIssueCode: responsePayload.FiscTWQRIssCode || undefined,
      uniGID: responsePayload.GID || undefined,
      isRefunded: !!~[
        ICashPayTradeStatus.REFUNDED,
        ICashPayTradeStatus.PARTIAL_REFUNDED,
      ].indexOf(responsePayload.TradeStatus),
    }) as O;
  }

  async refund(options: ICashPayRefundOptions): Promise<ICashPayOrder<CM>> {
    const totalRefundAmount =
      options.requestRefundAmount +
      (options.requestRefundCollectedAmount ?? 0) +
      (options.requestRefundConsignmentAmount ?? 0);

    if (totalRefundAmount <= 0) {
      throw new Error('Total refund amount must be greater than 0');
    }

    const orderId = options.refundOrderId ?? this.getOrderId();

    const payload: ICashPayRefundRequestPayloadBody = {
      PlatformID: this.merchantId,
      MerchantID: this.merchantId,
      OMerchantTradeNo: options.id,
      TransactionID: options.transactionId,
      StoreID: options.storeId ?? '',
      StoreName: options.storeName,
      MerchantTradeNo: orderId,
      RefundTotalAmount: Math.round(totalRefundAmount * 100).toString(),
      RefundItemAmt: Math.round(options.requestRefundAmount * 100).toString(),
      RefundUtilityAmt: Math.round(
        options.requestRefundCollectedAmount ?? 0,
      ).toString(),
      RefundCommAmt: Math.round(
        options.requestRefundConsignmentAmount ?? 0,
      ).toString(),
      MerchantTradeDate: DateTime.now().toFormat('yyyy/MM/dd HH:mm:ss'),
    };

    const encData = this.encrypt(JSON.stringify(payload));

    const formData = new FormData();

    formData.append('EncData', encData);

    const { data, headers } = await axios.post<ICashPayResponse>(
      `${this.baseUrl}/Cashier/RefundICPO`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-iCP-EncKeyID': this.aesKey.id,
          'X-iCP-Signature': this.signature(encData),
        },
      },
    );

    const now = DateTime.now();

    if (data.RtnCode !== I_CASH_PAY_SUCCESS_CODE) {
      return new ICashPayOrder<CM>({
        id: options.id,
        items: [],
        gateway: this,
        createdAt: now.toJSDate(),
        committedAt: null,
        failedCode: data.RtnCode.toString(),
        failedMessage: data.RtnMsg,
        isTWQRCode: false,
        isRefunded: false,
      });
    }

    const signature = headers['x-icp-signature'] ?? '';

    const verified = this.verify(JSON.stringify(data), signature);

    if (!verified) {
      return new ICashPayOrder<CM>({
        id: options.id,
        items: [],
        gateway: this,
        createdAt: now.toJSDate(),
        committedAt: null,
        failedCode: '-999',
        failedMessage: 'Signature verification failed',
        isTWQRCode: false,
        isRefunded: false,
      });
    }

    return this.query<ICashPayOrder<CM>>(orderId);
  }
}
