import { PaymentItem, PrepareOrderInput, Channel, CreditCardECI, OrderCommitMessage, PaymentPeriod, OrderCreditCardCommitMessage, OrderVirtualAccountCommitMessage, CreditCardAuthInfo, VirtualAccountInfo } from '@rytass/payments';
import { IncomingMessage, ServerResponse } from 'http';
import { ECPayPayment } from '.';
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
  checkoutPath?: string;
  withServer?: boolean;
  serverListener?: (req: IncomingMessage, res: ServerResponse) => void;
  ttl?: number; // Order Expire Time is ms
  onCommit?: (order: O) => void;
  onServerListen?: () => void;
}

type ECPayChannel = Channel.CREDIT_CARD | Channel.VIRTUAL_ACCOUNT;

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
  channel?: Channel.VIRTUAL_ACCOUNT;
  virtualAccountExpireDays?: number;
}

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
  VIRTUAL_ACCOUNT_WAITING = 'VIRTAL_ACCOUNT_WAITING',

  // ATM (Vistual Account)
  ATM_TAISHIN = 'ATM_TAISHIN',
  ATM_ESUN = 'ATM_ESUN',
  ATM_BOT = 'ATM_BOT',
  ATM_FUBON = 'ATM_FUBON',
  ATM_CHINATRUST = 'ATM_CHINATRUST',
  ATM_FIRST = 'ATM_FIRST',
  ATM_LAND = 'ATM_LAND',
  ATM_CATHAY = 'ATM_CATHAY',
  ATM_TACHONG = 'ATM_TACHONG',
  ATM_PANHSIN = 'ATM_PANHSIN',
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

export interface ECPayCallbackVirtualAccountPayload extends ECPayCallbackPayload {
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
  BankCode: string;
  vAccount: string;
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
    ECPayCallbackPaymentType.ATM_TAISHIN |
    ECPayCallbackPaymentType.ATM_ESUN |
    ECPayCallbackPaymentType.ATM_BOT |
    ECPayCallbackPaymentType.ATM_FUBON |
    ECPayCallbackPaymentType.ATM_CHINATRUST |
    ECPayCallbackPaymentType.ATM_FIRST |
    ECPayCallbackPaymentType.ATM_LAND |
    ECPayCallbackPaymentType.ATM_CATHAY |
    ECPayCallbackPaymentType.ATM_TACHONG |
    ECPayCallbackPaymentType.ATM_PANHSIN
  >;
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
    : never;

export type ECPayChannelCreditCard = ECPayOrderCreditCardCommitMessage;
export type ECPayChannelVirtualAccount = ECPayOrderVirtualAccountCommitMessage;
