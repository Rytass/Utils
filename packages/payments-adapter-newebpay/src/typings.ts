import { CreditCardECI, OrderCommitMessage, PaymentItem, PrepareOrderInput } from '@rytass/payments';
import { NewebPayPayment } from './newebpay-payment';
import { IncomingMessage, ServerResponse } from 'http';
import { NewebPayCreditCardCommitMessage, NewebPayCreditCardOrderInput } from './typings/credit-card.typing';
import { NewebPayLinePayCommitMessage, NewebPayLinePayOrderInput } from './typings/line-pay.typing';
import { NewebPayVirtualAccountCommitMessage, NewebPayVirtualAccountOrderInput } from './typings/virtual-account.typing';
import { NewebPayWebATMCommitMessage, NewebPayWebATMOrderInput } from './typings/webatm.typing';
import { NewebPayOrder } from './newebpay-order';

export enum NewebPaymentChannel {
  CREDIT = 1,
  ANDROID_PAY = 2,
  SAMSUNG_PAY = 4,
  UNION_PAY = 8,
  WEBATM = 16,
  VACC = 32,
  // CVS = 64,
  // BARCODE = 128,
  // ESUN_WALLET = 256,
  // TAIWAN_PAY = 512,
  // LINE_PAY = 1024,
  // EZPAY = 2048,
  // EZP_WECHAT = 4096,
  // EZP_ALIPAY = 8192,
}

export enum AllowUILanguage {
  ZH_TW = 'zh-tw',
  EN = 'en',
  JP = 'jp',
}

export interface NewebPayPrepareOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
  language?: AllowUILanguage;
  tradeLimit?: number;
  expireDate?: string;
  clientBackUrl?: string;
  email?: string;
  remark?: string;
  channel: number;
}

export interface NewebPayCommitMessage extends OrderCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date | null;
  platformTradeNumber: string;
  channel: NewebPaymentChannel;
}

export interface NewebPayOrderInit<OCM extends NewebPayCommitMessage> {
  id: string;
  items: PaymentItem[];
  gateway: NewebPayPayment<OCM>;
}

export interface NewebPayPrepareOrderInit<OCM extends NewebPayCommitMessage> extends NewebPayOrderInit<OCM> {
  makePayload: NewebPayMPGMakeOrderPayload;
}

export interface NewebPayOrderFromServerInit<OCM extends NewebPayCommitMessage> extends NewebPayOrderInit<OCM> {
  createdAt: Date;
  committedAt: Date | null;
  platformTradeNumber: string;
  channel: NewebPaymentChannel;
  status: NewebPayOrderStatusFromAPI;
}

export type NewebPayOrderInput<CM extends NewebPayCommitMessage> = CM extends NewebPayCreditCardCommitMessage
  ? NewebPayCreditCardOrderInput
  : CM extends NewebPayLinePayCommitMessage
  ? NewebPayLinePayOrderInput
  : CM extends NewebPayVirtualAccountCommitMessage
  ? NewebPayVirtualAccountOrderInput
  : CM extends NewebPayWebATMCommitMessage
  ? NewebPayWebATMOrderInput
  : NewebPayPrepareOrderInput;

export interface NewebPayPaymentInitOptions<O extends NewebPayOrder<NewebPayCommitMessage>> {
  baseUrl?: string;
  merchantId: string;
  aesKey: string;
  aesIv: string;
  language?: AllowUILanguage;
  serverHost?: string;
  callbackPath?: string;
  asyncInfoPath?: string;
  checkoutPath?: string;
  withServer?: boolean | 'ngrok';
  ttl?: number;
  serverListener?: (req: IncomingMessage, res: ServerResponse) => void;
  onCommit?: (order: O) => void;
  onServerListen?: () => void;
}

export interface NewebPayAPIResponseWrapper<T> {
  Status: 'SUCCESS' | string;
  Message: string;
  Result: T;
}

export interface NewebPayMPGMakeOrderPayload {
  MerchantID: string;
  TradeInfo: string;
  TradeSha: string;
  Version: '2.0';
  EncryptType: 0;
}

export interface NewebPayNotifyPayload {
  Status: 'SUCCESS';
  MerchantID: string;
  Version: '2.0';
  TradeInfo: string;
  TradeSha: string;
}

type NewebPayPaymentType = 'CREDIT' | 'ANDROIDPAY' | 'SAMSUNGPAY' | 'LINEPAY' | 'UNIONPAY' | 'WEBATM' | 'VACC' | 'CVS' | 'BARCODE' | 'ESUNWALLET' | 'TAIWANPAY' | 'EZPAY' | 'EZPWECHAT' | 'EZPALIPAY';

export interface NewebPayInfoRetriveEncryptedPayload {
  MerchantID: string;
  Amt: number;
  TradeNo: string;
  MerchantOrderNo: string;
  PaymentType: NewebPayPaymentType;
  ExpireDate: string; // YYYY-MM-DD
  ExpireTime: string; // HH:mm:ss
  BankCode?: string;
  CodeNo?: string;
  Barcode_1?: string;
  Barcode_2?: string;
  Barcode_3?: string;
  StoreCode?: string;
  StoreName?: string;
  StoreAddr?: string;
  TradeType?: 1 | 3;
  CVSCOMName?: string;
  CVSCOMPhone?: string;
  LgsNo?: string;
  LgsType?: 'B2C' | 'C2C';
}

export type NewebPayAuthBank = 'Esun' | 'Taishin' | 'CTBC' | 'NCCC' | 'CathayBk' | 'Citibank' | 'UBOT' | 'SFBank' | 'Fubon' | 'FirstBank' | 'KGI';
export type NewebPayThirdPartyAuthBank = 'Esun' | 'Linepay';
export type NewebPayCreditCardSubChannel = 'CREDIT' | 'FOREIGN' | 'UNIONPAY' | 'GOOGLEPAY' | 'SAMSUNGPAY' | 'DCC';
export type NewebPayThirdPartySubChannel = 'LINEPAY' | 'ESUNWALLET' | 'TAIWANPAY';

export enum NewebPayCreditCardSpeedCheckoutMode {
  NONE = 0,
  FIRST_TIME = 1,
  USED = 2,
  CANCEL = 9,
}

export interface NewebPayNotifyEncryptedPayload {
  MerchantID: string;
  Amt: number;
  TradeNo: string;
  MerchantOrderNo: string;
  PaymentType: NewebPayPaymentType;
  RespondType: 'JSON';
  PayTime: string; // YYYY-MM-DD HH:mm:ss
  IP: string;
  EscrowBank: 'HNCB' | '';
  RespondCode?: '00' | '';
  Auth?: string;
  Card6No?: string;
  Card4No?: string;
  Exp?: string; // Unknown Field
  AuthBank?: NewebPayAuthBank | NewebPayThirdPartyAuthBank;
  TokenUseStatus?: NewebPayCreditCardSpeedCheckoutMode;
  InstFirst?: number;
  InstEach?: number;
  Inst?: number;
  ECI?: CreditCardECI;
  RedAmt?: number;
  PaymentMethod?: NewebPayCreditCardSubChannel | NewebPayThirdPartySubChannel;
  DCC_Amt?: number;
  DCC_Rate?: number;
  DCC_Markup?: number;
  DCC_Currency?: string;
  DCC_Currency_Code?: number;
  PayBankCode?: string;
  PayerAccount5Code?: string;
  CodeNo?: string;
  StoreType?: 1 | 2 | 3 | 4 | '全家' | '7-ELEVEN' | '萊爾富' | 'OK mart';
  StoreID?: string;
  Barcode_1?: string;
  Barcode_2?: string;
  Barcode_3?: string;
  RepayTimes?: number;
  PayStore?: 'SEVEN' | 'FAMILY' | 'OK' | 'HILIFE';
  StoreCode?: string;
  StoreName?: string;
  StoreAddr?: string;
  TradeType?: 1 | 3;
  CVSCOMName?: string;
  CVSCOMPhone?: string;
  LgsNo?: string;
  LgsType?: 'B2C' | 'C2C';
  ChannelID?: 'ALIPAY' | 'WECHATPAY' | 'ACCLINK' | 'CREDIT' | 'CVS' | 'P2GEACC' | 'VACC' | 'WEBATM';
  ChannelNo?: string;
  PayAmt?: number;
  RedDisAmt?: number;
}

export interface NewebPayMPGMakeOrderEncryptedPayload extends Record<string, string | number | undefined> {
  MerchantID: string;
  RespondType: 'JSON';
  TimeStamp: string;
  Version: '2.0';
  LangType?: AllowUILanguage;
  MerchantOrderNo: string;
  Amt: number;
  ItemDesc: string; // max: 50 characters
  TradeLimit?: number;
  ExpireDate?: string;
  ReturnURL?: string; // Redirect Form POST
  NotifyURL?: string; // Webhook
  CustomerURL?: string; // Form POST (Barcode)
  ClientBackURL?: string;
  Email?: string;
  EmailModify: 0;
  LoginType: 0;
  OrderComment?: string;
  CREDIT?: 1 | 0;
  ANDROIDPAY?: 1 | 0;
  SAMSUNGPAY?: 1 | 0;
  LINEPAY?: 1 | 0;
  ImageUrl?: 1 | 0; // For linepay preview
  InstFlag?: string;
  CreditRed?: 1 | 0;
  UNIONPAY?: 1 | 0;
  WEBATM?: 1 | 0;
  VACC?: 1 | 0;
  BankType?: string;
  CVS?: 1 | 0;
  BARCODE?: 1 | 0;
  ESUNWALLET?: 1 | 0;
  TAIWANPAY?: 1 | 0;
  CVSCOM?: 0; // Disable CVS Logistic
  EZPAY?: 1 | 0;
  EZPWECHAT?: 1 | 0;
  EZPALIPAY?: 1 | 0;
  LgsType?: undefined; // Disable CVS Logistic
}

export interface NewebPayQueryRequestPayload extends Record<string, string> {
  MerchantID: string;
  Version: '1.3';
  RespondType: 'JSON';
  CheckValue: string;
  TimeStamp: string;
  MerchantOrderNo: string;
  Amt: string;
  Gateway: 'Composite' | '';
}

export enum NewebPayOrderStatusFromAPI {
  INITED = '0',
  COMMITTED = '1',
  FAILED = '2',
  CANCELLED = '3',
  REFUNDED = '6',
  WAITING_BANK = '9',
}

export interface NewebPayQueryResponseBasePayload {
  MerchantID: string;
  Amt: number;
  TradeNo: string;
  MerchantOrderNo: string;
  TradeStatus: NewebPayOrderStatusFromAPI;
  PaymentType: NewebPayPaymentType;
  CreateTime: string; // YYYY-MM-DD HH:mm:ss
  PayTime?: string; // YYYY-MM-DD HH:mm:ss
  CheckCode: string;
  FundTime: string; // YYYY-MM-DD
  ShopMerchantID?: string;
}

export enum NewebPayCreditCardBalanceStatus {
  UNSETTLED = '0',
  WAITING = '1',
  WORKING = '2',
  SETTLED = '3',
}

export interface NewebPayQueryCreditCardResponsePayload extends NewebPayQueryResponseBasePayload {
  RespondCode: string;
  Auth: string;
  ECI: CreditCardECI;
  CloseAmt: string;
  CloseStatus: NewebPayCreditCardBalanceStatus;
  BackBalance: string;
  BackStatus: NewebPayCreditCardBalanceStatus;
  RespondMsg: string;
  Inst: string;
  InstFirst: string;
  InstEach: string;
  PaymentMethod: NewebPayCreditCardSubChannel;
  Card6No: string;
  Card4No: string;
  AuthBank: NewebPayAuthBank;
}

export interface NewebPayQueryATMResponsePayload extends NewebPayQueryResponseBasePayload {
  PayInfo: string;
  ExpireDate: string; // YYYY-MM-DD HH:mm:ss
  OrderStatus: NewebPayOrderStatusFromAPI;
}

export type NewebPayQueryBarcodeResponsePayload = NewebPayQueryATMResponsePayload;
export type NewebPayQueryCVSResponsePayload = NewebPayQueryATMResponsePayload;
export type NewebPayQueryVistualAccountResponsePayload = NewebPayQueryATMResponsePayload;

export interface NewebPayQueryLogisticResponsePayload extends NewebPayQueryResponseBasePayload {
  StoreType: '全家' | '7-ELEVEN' | '萊爾富' | 'OK mart';
  StoreCode: string;
  StoreName: string;
  LgsNo: string;
  LgsType: 'B2C' | 'C2C';
}

export interface NewebPayQueryThirdPartyResponsePayload extends NewebPayQueryResponseBasePayload {
  RespondCode: string;
  CloseAmt: number;
  CloseStatus: NewebPayCreditCardBalanceStatus;
  BackBalance: string;
  BackStatus: NewebPayCreditCardBalanceStatus;
  RespondMsg: string;
  PaymentMethod: NewebPayThirdPartySubChannel;
  AuthBank: NewebPayThirdPartyAuthBank;
}

export type NewebPayQueryLinePayResponsePayload = NewebPayQueryThirdPartyResponsePayload;
export type NewebPayQueryEsunWalletResponsePayload = NewebPayQueryThirdPartyResponsePayload;
export type NewebPayQueryTaiwanPayResponsePayload = NewebPayQueryThirdPartyResponsePayload;

export type NewebPayQueryResponsePayload = NewebPayQueryCreditCardResponsePayload | NewebPayQueryATMResponsePayload | NewebPayQueryLogisticResponsePayload | NewebPayQueryThirdPartyResponsePayload;

export interface NewebPayCreditCardCancelRequestPayload extends Record<string, string> {
  MerchantID_: string;
  PostData_: string;
}

export interface NewebPayCreditCardCancelEncryptedRequestPayload {
  RespondType: 'JSON';
  Version: '1.0';
  Amt: number;
  MerchantOrderNo: string;
  IndexType: 1;
  TimeStamp: string;
}

export interface NewebPayCreditCardCancelResponse {
  MerchantID: string;
  TradeNo: string;
  Amt: number;
  MerchantOrderNo: string;
  CheckCode: string;
}

export interface NewebPayCreditCardCloseRequestPayload extends Record<string, string> {
  MerchantID_: string;
  PostData_: string;
}

export interface NewebPayCreditCardCloseEncryptedRequestPayload {
  RespondType: 'JSON';
  Version: '1.0';
  Amt: number;
  MerchantOrderNo: string;
  TimeStamp: string;
  IndexType: 1;
  CloseType: 1 | 2;
  Cancel?: 1;
}

export interface NewebPayCreditCardCloseResponse {
  MerchantID: string;
  TradeNo: string;
  Amt: number;
  MerchantOrderNo: string;
}
