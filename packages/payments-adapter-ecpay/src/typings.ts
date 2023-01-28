import { PaymentItem, PrepareOrderInput, Channel, CreditCardECI, OrderCommitMessage, PaymentPeriod, OrderCreditCardCommitMessage, OrderVirtualAccountCommitMessage, OrderCVSCommitMessage, OrderBarcodeCommitMessage, OrderApplePayCommitMessage } from '@rytass/payments';
import { IncomingMessage, ServerResponse } from 'http';
import { ECPayPayment } from './ecpay-payment';
import { ECPayOrder } from './ecpay-order';

export interface ECPayInitOptions<O extends ECPayOrder<ECPayCommitMessage>> {
  language?: Language;
  baseUrl?: string;
  merchantId?: string;
  merchantCheckCode?: string;
  hashKey?: string;
  hashIv?: string;
  serverHost?: string;
  callbackPath?: string;
  asyncInfoPath?: string;
  checkoutPath?: string;
  withServer?: boolean | 'ngrok';
  serverListener?: (req: IncomingMessage, res: ServerResponse) => void;
  ttl?: number; // Order Expire Time is ms
  onCommit?: (order: O) => void;
  onInfoRetrieved?: (order: O) => void;
  onServerListen?: () => void;
  emulateRefund?: boolean,
}

export interface ECPayCreditCardOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
  description?: string;
  clientBackUrl?: string;
  channel?: Channel.CREDIT_CARD;
  memory?: boolean;
  memberId?: string;
  allowCreditCardRedeem?: boolean;
  allowUnionPay?: boolean;
  installments?: string;
  period?: PaymentPeriod;
}

export interface ECPayVirtualAccountOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
  description?: string;
  clientBackUrl?: string;
  channel: Channel.VIRTUAL_ACCOUNT;
  bank?: ECPayATMBank;
  virtualAccountExpireDays?: number;
}

export interface ECPayCVSOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
  description?: string;
  clientBackUrl?: string;
  channel: Channel.CVS_KIOSK;
  cvsExpireMinutes?: number;
}

export interface ECPayBarcodeOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
  description?: string;
  clientBackUrl?: string;
  channel: Channel.CVS_BARCODE;
  cvsBarcodeExpireDays?: number;
}

export interface ECPayApplePayOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
  description?: string;
  clientBackUrl?: string;
  channel: Channel.APPLE_PAY;
}

export interface OrderInit<OCM extends ECPayCommitMessage> {
  id: string;
  items: PaymentItem[];
  gateway: ECPayPayment<OCM>;
}

export interface OrderCreateInit<OCM extends ECPayCommitMessage> extends OrderInit<OCM> {
  id: string;
  items: PaymentItem[];
  form: ECPayOrderForm;
  gateway: ECPayPayment<OCM>;
}

export interface OrderFromServerInit<OCM extends ECPayCommitMessage> extends OrderInit<OCM> {
  id: string;
  items: PaymentItem[];
  gateway: ECPayPayment<OCM>;
  createdAt: Date;
  committedAt: Date | null;
  platformTradeNumber: string;
  paymentType: ECPayCallbackPaymentType;
  status: ECPayQueryResultStatus;
}

export enum ECPayOrderFormKey {
  MerchantID = 'MerchantID',
  MerchantTradeNo = 'MerchantTradeNo',
  MerchantTradeDate = 'MerchantTradeDate',
  PaymentType = 'PaymentType',
  TotalAmount = 'TotalAmount',
  TradeDesc = 'TradeDesc',
  ItemName = 'ItemName',
  ReturnURL = 'ReturnURL',
  ChoosePayment = 'ChoosePayment',
  NeedExtraPaidInfo = 'NeedExtraPaidInfo',
  EncryptType = 'EncryptType',
  OrderResultURL = 'OrderResultURL',
  Language = 'Language',
  BindingCard = 'BindingCard',
  MerchantMemberID = 'MerchantMemberID',
  Redeem = 'Redeem',
  UnionPay = 'UnionPay',
  CreditInstallment = 'CreditInstallment',
  PeriodAmount = 'PeriodAmount',
  PeriodType = 'PeriodType',
  Frequency = 'Frequency',
  ExecTimes = 'ExecTimes',
  PeriodReturnURL = 'PeriodReturnURL',
  ExpireDate = 'ExpireDate',
  PaymentInfoURL = 'PaymentInfoURL',
  ClientRedirectURL = 'ClientRedirectURL',
  CheckMacValue = 'CheckMacValue',
  ChooseSubPayment = 'ChooseSubPayment',
  StoreExpireDate = 'StoreExpireDate',
  CustomField1 = 'CustomField1',
  CustomField2 = 'CustomField2',
  CustomField3 = 'CustomField3',
  CustomField4 = 'CustomField4',
}

export type ECPayOrderForm = Record<ECPayOrderFormKey, string>;

export enum ECPayATMBank {
  BOT = 'BOT',
  CHINATRUST = 'CHINATRUST',
  FIRST = 'FIRST',
  LAND = 'LAND',
  TACHONG = 'TACHONG',
  PANHSIN = 'PANHSIN',
}

export enum ECPayCallbackPaymentType {
  CREDIT_CARD = 'Credit_CreditCard',
  VIRTUAL_ACCOUNT_WAITING = 'VIRTAL_ACCOUNT_WAITING',

  // ATM (Vistual Account)
  ATM_BOT = 'ATM_BOT',
  ATM_CHINATRUST = 'ATM_CHINATRUST',
  ATM_FIRST = 'ATM_FIRST',
  ATM_LAND = 'ATM_LAND',
  ATM_TACHONG = 'ATM_TACHONG',
  ATM_PANHSIN = 'ATM_PANHSIN',

  // CVS Kiosk
  CVS = 'CVS_CVS',
  CVS_OK = 'CVS_OK',
  CVS_FAMILY = 'CVS_FAMILY',
  CVS_HILIFE = 'CVS_HILIFE',
  CVS_IBON = 'CVS_IBON',

  // CVS Barcode
  BARCODE = 'BARCODE_BARCODE',

  // Apple Pay
  APPLY_PAY = 'ApplePay',
}

export enum ECPayCallbackSimulatePaidState {
  NO = 0,
  YES = 1,
}

export enum ECPayCallbackReturnMessage {
  SUCCESS = '交易成功',
  SUPPLEMENTARY = 'paid',
  CLIENT_POST = 'Succeeded',
}

export enum ECPayCallbackReturnCode {
  SUCCESS = 1,
}

export interface ECPayCallbackPayload {
  MerchantID: string;
  MerchantTradeNo: string;
  StoreID: string;
  RtnCode: ECPayCallbackReturnCode | number;
  RtnMsg: ECPayCallbackReturnMessage;
  TradeNo: string;
  TradeAmt: number;
  PaymentType: ECPayCallbackPaymentType;
  TradeDate: string;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
}

export interface ECPayCallbackCreditPayload extends ECPayCallbackPayload {
  MerchantID: string;
  MerchantTradeNo: string;
  StoreID: string;
  RtnCode: ECPayCallbackReturnCode | number;
  RtnMsg: ECPayCallbackReturnMessage;
  TradeNo: string;
  TradeAmt: number;
  PaymentDate: string;
  PaymentType: ECPayCallbackPaymentType.CREDIT_CARD;
  TradeDate: string;
  SimulatePaid: ECPayCallbackSimulatePaidState;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
  gwsr: string; // Authentication Code
  process_date: string;
  auth_code: string; // Credit Card Auth Code (6 digits)
  amount: number;
  eci: CreditCardECI;
  card4no: string;
  card6no: string;
}

export interface ECPayCallbackVirtualAccountPayload extends ECPayCallbackPayload {
  MerchantID: string;
  MerchantTradeNo: string;
  StoreID: string;
  RtnCode: ECPayCallbackReturnCode | number;
  RtnMsg: ECPayCallbackReturnMessage;
  TradeNo: string;
  TradeAmt: number;
  PaymentDate: string;
  PaymentType: Extract<
    ECPayCallbackPaymentType,
    ECPayCallbackPaymentType.ATM_BOT |
    ECPayCallbackPaymentType.ATM_CHINATRUST |
    ECPayCallbackPaymentType.ATM_FIRST |
    ECPayCallbackPaymentType.ATM_LAND |
    ECPayCallbackPaymentType.ATM_PANHSIN |
    ECPayCallbackPaymentType.ATM_TACHONG
  >;
  TradeDate: string;
  SimulatePaid: ECPayCallbackSimulatePaidState;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
  ATMAccBank: string;
  ATMAccNo: string;
}

export interface ECPayCallbackCVSPayload extends ECPayCallbackPayload {
  MerchantID: string;
  MerchantTradeNo: string;
  StoreID: string;
  RtnCode: ECPayCallbackReturnCode | number;
  RtnMsg: ECPayCallbackReturnMessage;
  TradeNo: string;
  TradeAmt: number;
  PaymentDate: string;
  PaymentType: Extract<
    ECPayCallbackPaymentType,
    ECPayCallbackPaymentType.CVS |
    ECPayCallbackPaymentType.CVS_FAMILY |
    ECPayCallbackPaymentType.CVS_HILIFE |
    ECPayCallbackPaymentType.CVS_IBON |
    ECPayCallbackPaymentType.CVS_OK
  >;
  TradeDate: string;
  SimulatePaid: ECPayCallbackSimulatePaidState;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
  PaymentNo: string;
  PayFrom: string;
}

export interface ECPayCallbackBarcodePayload extends ECPayCallbackPayload {
  MerchantID: string;
  MerchantTradeNo: string;
  StoreID: string;
  RtnCode: ECPayCallbackReturnCode | number;
  RtnMsg: ECPayCallbackReturnMessage;
  TradeNo: string;
  TradeAmt: number;
  PaymentDate: string;
  PaymentType: ECPayCallbackPaymentType.BARCODE;
  TradeDate: string;
  SimulatePaid: ECPayCallbackSimulatePaidState;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
}

export interface ECPayAsyncInformationPayload {
  MerchantID: string;
  MerchantTradeNo: string;
  StoreID: string;
  RtnCode: ECPayCallbackReturnCode | number;
  RtnMsg: ECPayCallbackReturnMessage;
  TradeNo: string;
  TradeAmt: number;
  PaymentType: ECPayCallbackPaymentType;
  TradeDate: string;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
}

export interface ECPayAsyncInformationVirtualAccountPayload extends ECPayAsyncInformationPayload {
  MerchantID: string;
  MerchantTradeNo: string;
  StoreID: string;
  RtnCode: ECPayCallbackReturnCode | number;
  RtnMsg: ECPayCallbackReturnMessage;
  TradeNo: string;
  TradeAmt: number;
  PaymentType: Extract<
    ECPayCallbackPaymentType,
    ECPayCallbackPaymentType.ATM_BOT |
    ECPayCallbackPaymentType.ATM_CHINATRUST |
    ECPayCallbackPaymentType.ATM_FIRST |
    ECPayCallbackPaymentType.ATM_LAND |
    ECPayCallbackPaymentType.ATM_PANHSIN |
    ECPayCallbackPaymentType.ATM_TACHONG
  >;
  TradeDate: string;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
  BankCode: string;
  vAccount: string;
  ExpireDate: string;
}

export interface ECPayAsyncInformationCVSPayload extends ECPayAsyncInformationPayload {
  MerchantID: string;
  MerchantTradeNo: string;
  StoreID: string;
  RtnCode: ECPayCallbackReturnCode | number;
  RtnMsg: ECPayCallbackReturnMessage;
  TradeNo: string;
  TradeAmt: number;
  PaymentType: Extract<
    ECPayCallbackPaymentType,
    ECPayCallbackPaymentType.CVS |
    ECPayCallbackPaymentType.CVS_FAMILY |
    ECPayCallbackPaymentType.CVS_HILIFE |
    ECPayCallbackPaymentType.CVS_IBON |
    ECPayCallbackPaymentType.CVS_OK
  >;
  TradeDate: string;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
  ExpireDate: string;
  PaymentNo: string;
  Barcode1: string;
  Barcode2: string;
  Barcode3: string;
}

export interface ECPayAsyncInformationBarcodePayload extends ECPayAsyncInformationPayload {
  MerchantID: string;
  MerchantTradeNo: string;
  StoreID: string;
  RtnCode: ECPayCallbackReturnCode | number;
  RtnMsg: ECPayCallbackReturnMessage;
  TradeNo: string;
  TradeAmt: number;
  PaymentType: ECPayCallbackPaymentType.BARCODE;
  TradeDate: string;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
  ExpireDate: string;
  PaymentNo: string;
  Barcode1: string;
  Barcode2: string;
  Barcode3: string;
}

export interface ECPayOrderCreditCardCommitMessage extends OrderCreditCardCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date;
  merchantId: string;
  tradeNumber: string;
  tradeDate: Date;
  paymentType: ECPayCallbackPaymentType.CREDIT_CARD;
}

export interface ECPayOrderVirtualAccountCommitMessage extends OrderVirtualAccountCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date | null;
  merchantId: string;
  tradeNumber: string;
  tradeDate: Date;
  paymentType: Extract<
    ECPayCallbackPaymentType,
    ECPayCallbackPaymentType.ATM_BOT |
    ECPayCallbackPaymentType.ATM_CHINATRUST |
    ECPayCallbackPaymentType.ATM_FIRST |
    ECPayCallbackPaymentType.ATM_LAND |
    ECPayCallbackPaymentType.ATM_TACHONG |
    ECPayCallbackPaymentType.ATM_PANHSIN
  >;
}

export interface ECPayOrderCVSCommitMessage extends OrderCVSCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date | null;
  merchantId: string;
  tradeNumber: string;
  tradeDate: Date;
  paymentType: Extract<
    ECPayCallbackPaymentType,
    ECPayCallbackPaymentType.CVS |
    ECPayCallbackPaymentType.CVS_OK |
    ECPayCallbackPaymentType.CVS_FAMILY |
    ECPayCallbackPaymentType.CVS_HILIFE |
    ECPayCallbackPaymentType.CVS_IBON
  >;
}

export interface ECPayOrderBarcodeCommitMessage extends OrderBarcodeCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date | null;
  merchantId: string;
  tradeNumber: string;
  tradeDate: Date;
  paymentType: ECPayCallbackPaymentType.BARCODE;
}

export interface ECPayOrderApplePayCommitMessage extends OrderApplePayCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date | null;
  merchantId: string;
  tradeNumber: string;
  tradeDate: Date;
  paymentType: ECPayCallbackPaymentType.APPLY_PAY;
}

export interface ECPayCommitMessage extends OrderCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date | null;
  merchantId: string;
  tradeNumber: string;
  tradeDate: Date;
  paymentType: Exclude<ECPayCallbackPaymentType, ECPayCallbackPaymentType.VIRTUAL_ACCOUNT_WAITING>;
}

export enum ECPayQueryResultStatus {
  PRE_COMMIT = '0',
  COMMITTED = '1',
  FAILED = '10200095',
}

export interface ECPayQueryResultPayload {
  MerchantID: string;
  MerchantTradeNo: string;
  StoreID: string;
  TradeNo: string;
  TradeAmt: string;
  PaymentDate: string;
  PaymentType: ECPayCallbackPaymentType;
  HandlingCharge: string;
  PaymentTypeChargeFee: string;
  TradeDate: string;
  TradeStatus: ECPayQueryResultStatus;
  ItemName: string;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
  amount: string;
  auth_code: string;
  card4no: string;
  card6no: string;
  ATMAccBank: string;
  ATMAccNo: string;
  eci: string;
  ExecTimes: string;
  Frequency: string;
  gwsr: string;
  HandlingChange: string;
  process_date: string;
  PayFrom: string;
}

export enum Language {
  ENGLISH = 'ENG',
  KOREAN = 'KOR',
  JAPANESE = 'JPN',
  SIMPLIFIED_CHINESE = 'CHI',
  TRADITIONAL_CHINESE = '',
}

export enum ECPayCreditCardOrderStatus {
  CLOSED = '已關帳',
  CANCELLED = '已取消',
  MANUALLY_CANCELLED = '操作取消',
  UNAUTHORIZED = '未授權',
  AUTHORIZED = '已授權',
}

export enum ECPayCredirCardOrderCloseStatus {
  PREPARE = '要關帳',
  COMMITTED = '已關帳',
  CANCELLED = '已取消',
  MANUALLY_CANCELLED = '操作取消',
}

export interface ECPayOrderDoActionResponse {
  MerchantID: string;
  MerchantTradeNo: string;
  TradeNo: string;
  RtnCode: number;
  RtnMsg: string;
}

export interface ECPayCreditCardDetailQueryResponse {
  RtnMsg: string;
  RtnValue: {
    TradeID: string;
    amount: string;
    clsamt: string;
    authtime: string;
    status: ECPayCreditCardOrderStatus;
    close_data: {
      status: ECPayCredirCardOrderCloseStatus;
      sno: string;
      amount: string;
      datetime: string;
    }[];
  };
}

export interface ECPayOrderActionPayload extends Record<string, string> {
  MerchantID: string;
  MerchantTradeNo: string;
  TradeNo: string;
  Action: 'R' | 'N';
  TotalAmount: string;
  CheckMacValue: string;
}

export interface ECPayCreditCardDetailQueryPayload extends Record<string, string> {
  MerchantID: string;
  CreditRefundedId: string;
  CreditAmount: string;
  CreditCheckCode: string;
  CheckMacValue: string;
}

export interface ECPayQueryOrderPayload extends Record<string, string> {
  MerchantID: string;
  MerchantTradeNo: string;
  TimeStamp: string;
  PlatformID: string;
  CheckMacValue: string;
}

export type GetOrderInput<CM extends ECPayCommitMessage> = CM extends ECPayOrderCreditCardCommitMessage
  ? ECPayCreditCardOrderInput
  : CM extends ECPayOrderVirtualAccountCommitMessage
  ? ECPayVirtualAccountOrderInput
  : CM extends ECPayOrderCVSCommitMessage
  ? ECPayCVSOrderInput
  : CM extends ECPayOrderBarcodeCommitMessage
  ? ECPayBarcodeOrderInput
  : CM extends ECPayOrderApplePayCommitMessage
  ? ECPayApplePayOrderInput
  : never;

export type ECPayChannelCreditCard = ECPayOrderCreditCardCommitMessage;
export type ECPayChannelVirtualAccount = ECPayOrderVirtualAccountCommitMessage;
export type ECPayChannelCVS = ECPayOrderCVSCommitMessage;
export type ECPayChannelBarcode = ECPayOrderBarcodeCommitMessage;
export type ECPayChannelApplePay = ECPayOrderApplePayCommitMessage;
