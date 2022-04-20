import { PaymentItem, PrepareOrderInput, Channel, CreditCardECI, OrderCommitMessage, PaymentPeriod } from '@rytass/payments';
import { IncomingMessage, ServerResponse } from 'http';
import { ECPayPayment } from '.';

export interface ECPayInitOptions<O> {
  language?: Language;
  baseUrl?: string;
  merchantId?: string;
  merchantCheckCode?: string;
  hashKey?: string;
  hashIv?: string;
  serverHost?: string;
  callbackPath?: string;
  checkoutPath?: string;
  withServer?: boolean;
  serverListener?: (req: IncomingMessage, res: ServerResponse) => void;
  ttl?: number; // Order Expire Time is ms
  onCommit?: (order: O) => void;
  onServerListen?: () => void;
}

type ECPayChannel = Channel.CREDIT_CARD | Channel.VIRTUAL_ACCOUNT;

export interface ECPayOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
  description?: string;
  clientBackUrl?: string;
  channel?: ECPayChannel;
  memory?: boolean;
  memberId?: string;
  allowCreditCardRedeem?: boolean;
  allowUnionPay?: boolean;
  installments?: string;
  period?: PaymentPeriod;
  virtualAccountExpireDays?: number;
}

export interface OrderInit {
  id: string;
  items: PaymentItem[];
  gateway: ECPayPayment;
}

export interface OrderCreateInit extends OrderInit {
  id: string;
  items: PaymentItem[];
  form: ECPayOrderForm;
  gateway: ECPayPayment;
}

export interface OrderFromServerInit extends OrderInit {
  id: string;
  items: PaymentItem[];
  gateway: ECPayPayment;
  createdAt: Date;
  committedAt: Date | null;
  platformTradeNumber: string;
  paymentType: ECPayCallbackPaymentType;
  status: ECPayQueryResultStatus;
}

enum ECPayOrderFormKey {
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
}

export type ECPayOrderForm = Record<ECPayOrderFormKey, string>;

export enum ECPayCallbackPaymentType {
  CREDIT_CARD = 'Credit_CreditCard',
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
  PaymentDate: string;
  PaymentType: ECPayCallbackPaymentType;
  TradeDate: string;
  SimulatePaid: ECPayCallbackSimulatePaidState;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
  gwsr: number; // Authentication Code
  process_date: string;
  auth_code: string; // Credit Card Auth Code (6 digits)
  amount: number;
  eci: CreditCardECI;
  card4no: string;
  card6no: string;
}

export interface ECPayCommitMessage extends OrderCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date;
  merchantId: string;
  tradeNumber: string;
  tradeDate: Date;
  paymentType: ECPayCallbackPaymentType;
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
  TradeAmt: number;
  PaymentDate: string;
  PaymentType: ECPayCallbackPaymentType;
  HandlingCharge: number;
  PaymentTypeChargeFee: number;
  TradeDate: string;
  TradeStatus: ECPayQueryResultStatus;
  ItemName: string;
  CustomField1: string;
  CustomField2: string;
  CustomField3: string;
  CustomField4: string;
  CheckMacValue: string;
}

export enum Language {
  ENGLISH = 'ENG',
  KOREAN = 'KOR',
  JAPANESE = 'JPN',
  SIMPLIFIED_CHINESE = 'CHI',
  TRADITIONAL_CHINESE = '',
}
