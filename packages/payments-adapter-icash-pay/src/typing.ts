import { OrderCommitMessage } from '@rytass/payments';
import { ICashPayOrderItem } from './icash-pay-order-item';
import { ICashPayPayment } from './icash-pay-payment';

export interface ICashPayCommitMessage extends OrderCommitMessage {}

export enum ICashPayBaseUrls {
  PRODUCTION = 'https://payment.icashpay.com.tw/api/V2/Payment',
  DEVELOPMENT = 'https://icp-payment-preprod.icashpay.com.tw/api/V2/Payment',
}

export interface ICashPayAESKey {
  id: string;
  key: string;
  iv: string;
}

export interface ICashPayPaymentInitOptions {
  baseUrl: ICashPayBaseUrls;
  merchantId: string;
  clientPrivateKey: string;
  serverPublicKey: string;
  aesKey: ICashPayAESKey;
}

export interface ICashPayPrepareOptions {
  id?: string;
  items: ICashPayOrderItem[];
  storeId?: string;
  storeName: string;
  barcode: string;
  amount: number;
  collectedAmount?: number;
  consignmentAmount?: number;
  nonRedeemAmount?: number;
  collectedNonRedeemAmount?: number;
  consignmentNonRedeemAmount?: number;
  nonPointAmount?: number;
}

export interface ICashPayRefundOptions {
  id: string;
  storeId?: string;
  storeName: string;
  transactionId: string;
  requestRefundAmount: number;
  requestRefundCollectedAmount?: number;
  requestRefundConsignmentAmount?: number;
  refundOrderId?: string;
}

export interface ICashPayDeductRequestPayloadBody {
  PlatformID?: string;
  MerchantID: string;
  MerchantTradeNo: string;
  StoreID?: string;
  StoreName: string;
  MerchantTradeDate: string; // yyyy/MM/dd HH:mm:ss
  TotalAmount: string;
  ItemAmt: string;
  UtilityAmt: string;
  CommAmt: string;
  ItemNonRedeemAmt: string;
  UtilityNonRedeemAmt: string;
  CommNonRedeemAmt: string;
  NonPointAmt: string;
  Item: null;
  Barcode: string;
}

export interface ICashPayDeductResponsePayloadBody {
  PlatformID: string;
  MerchantID: string;
  MerchantTradeNo: string;
  TransactionID: string;
  ICPAccount: string;
  TotalAmount: string;
  ICPAmount: string;
  BonusAmt: string;
  PaymentDate: string; // yyyy/MM/dd HH:mm:ss
  PaymentType: ICashPayPaymentType;
  MMemberID?: string;
  MobileInvoiceCarry?: string;
  Timestamp: string; // yyyy/MM/dd HH:mm:ss UTC+8
  MaskedPan?: string;
  IsFiscTWQC: 1 | 0;
  FiscTWQRIssCode?: string;
  GID?: string;
}

export interface ICashPayRefundRequestPayloadBody {
  PlatformID?: string;
  MerchantID: string;
  OMerchantTradeNo: string;
  TransactionID: string;
  StoreID?: string;
  StoreName: string;
  MerchantTradeNo: string;
  RefundTotalAmount: string;
  RefundItemAmt: string;
  RefundUtilityAmt: string;
  RefundCommAmt: string;
  MerchantTradeDate: string; // yyyy/MM/dd HH:mm:ss
}

export interface ICashPayRefundResponsePayloadBody {
  PlatformID?: string;
  MerchantID: string;
  MerchantTradeNo: string;
  TransactionID: string;
  PaymentDate: string; // yyyy/MM/dd HH:mm:ss
  RefundTotalAmount: string;
  RefundICPAmount: string;
  RefundBonusAmt: string;
  OMerchantTradeNo: string;
  OTotalAmount: string;
  OICPAmount: string;
  OBonusAmt: string;
  MMemberID?: string;
  Timestamp: string; // yyyy/MM/dd HH:mm:ss UTC+8
}

export interface ICashPayQueryRequestPayloadBody {
  PlatformID?: string;
  MerchantID: string;
  MerchantTradeNo: string;
}

export enum ICashPayTradeStatus {
  'INITED' = '0',
  'COMMITTED' = '1',
  'REFUNDED' = '2',
  'PARTIAL_REFUNDED' = '3',
  'CANCELLED' = '4',
  'WAITING_SETTLEMENT' = '5',
  'SETTLEMENT_FAILED' = '6',
  'FAILED' = '7',
}

export enum ICashPayTradeType {
  'DEDUCT' = '0',
  'REFUND' = '1',
}

export interface ICashPayQueryResponsePayloadBody {
  PlatformID: string;
  MerchantID: string;
  MerchantTradeNo: string;
  TransactionID: string;
  TradeStatus: ICashPayTradeStatus;
  ICPAccount: string;
  TradeType: ICashPayTradeType;
  PaymentType: ICashPayPaymentType;
  AllocateStatus: '0' | '1';
  MaskedPan?: string;
  VToken?: string;
  MMemberID?: string;
  MobileInvoiceCarry?: string;
  PaymentDate: string; // yyyy/MM/dd HH:mm:ss
  Timestamp: string; // yyyy/MM/dd HH:mm:ss UTC+8
  IsFiscTWQC: 1 | 0;
  FiscTWQRIssCode?: string;
  GID?: string;

  // Deduct
  TotalAmount?: string;
  ICPAmount?: string;
  BonusAmt?: string;

  // Refund
  RefundTotalAmount?: string;
  RefundICPAmount?: string;
  RefundBonusAmt?: string;
  OTotalAmount?: string;
  OICPAmount?: string;
  OBonusAmt?: string;
}

export interface ICashPayResponse {
  EncData: string;
  RtnCode: number;
  RtnMsg: string;
}

export enum ICashPayPaymentType {
  CREDIT_CARD = '0',
  I_CASH = '1',
  BANK = '2',
}

export interface ICashPayOrderInitOptions {
  id: string;
  items: ICashPayOrderItem[];
  gateway: ICashPayPayment<ICashPayCommitMessage>;
  createdAt: Date;
  committedAt?: Date | null;
  failedCode?: string;
  failedMessage?: string;
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
  isRefunded: boolean;
  deductEncData?: string;
}

export const I_CASH_PAY_SUCCESS_CODE = 1;
