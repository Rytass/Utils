/**
 * @file typings.ts
 * @desc
 * CTBC Micro Fast Pay adapter 的所有型別定義集中於此檔案。
 *
 * 包含：
 * - 綁卡流程的 Request / Callback 結構
 * - 請款（PayJSON）所需的 Payload 與 Result
 * - 綁卡與訂單狀態枚舉（state machine）
 * - Gateway 初始化參數型別
 * - MAC/TXN 處理通用格式
 */

import { CardType, CheckoutWithBoundCardOptions, OrderCreditCardCommitMessage, PaymentItem } from '@rytass/payments';
import { IncomingMessage, ServerResponse } from 'node:http';
import { CTBCBindCardRequest } from './ctbc-bind-card-request';
import { CTBCOrder } from './ctbc-order';
import { CTBCPayment } from './ctbc-payment';

export interface OrderCache<
  CM extends CTBCOrderCommitMessage = CTBCOrderCommitMessage,
  Key extends string = string,
  Value extends CTBCOrder<CM> = CTBCOrder<CM>,
> {
  get: (key: Key) => Promise<Value | undefined>;
  set: (key: Key, value: Value) => Promise<void>;
}

export interface BindCardRequestCache<
  Key extends string = string,
  Value extends CTBCBindCardRequest = CTBCBindCardRequest,
> {
  get: (key: Key) => Promise<Value | undefined>;
  set: (key: Key, value: Value) => Promise<void>;
}

export enum CTBCOrderFormKey {
  URLEnc = 'URLEnc',
  merID = 'merID',
}

export type CTBCPayOrderForm = Record<CTBCOrderFormKey, string>;

export interface OrderCreateInit<OCM extends CTBCOrderCommitMessage = CTBCOrderCommitMessage> {
  id: string;
  items: PaymentItem[];
  form?: CTBCPayOrderForm;
  gateway: CTBCPayment<OCM>;
  clientBackUrl?: string | null;
  createdAt?: Date; // 訂單建立時間，預設為當前時間
  checkoutMemberId?: string; // 綁定會員 ID（若有）
  checkoutCardId?: string; // 綁定卡片 ID（若有）
  cardType?: CardType; // 卡片類型，預設為 'VMJ'
  xid?: string; // 交易 ID（若有）
}

export interface CTBCPaymentOptions<O extends CTBCOrder<CTBCOrderCommitMessage> = CTBCOrder<CTBCOrderCommitMessage>> {
  merchantId: string;
  merId: string;
  txnKey: string;
  terminalId: string;
  baseUrl?: string;
  requireCacheHit?: boolean;
  withServer?: boolean | 'ngrok';
  serverHost?: string; // Default: http://localhost:3000
  callbackPath?: string;
  checkoutPath?: string;
  bindCardPath?: string;
  boundCardPath?: string;
  boundCardCheckoutResultPath?: string;
  serverListener?: (req: IncomingMessage, res: ServerResponse) => void;
  onServerListen?: () => void;
  onCommit?: (order: O) => void;
  orderCache?: OrderCache;
  orderCacheTTL?: number; // Order Expire Time is ms
  bindCardRequestsCache?: BindCardRequestCache;
  bindCardRequestsCacheTTL?: number; // Order Expire Time is ms
  isAmex?: boolean;
}

export interface CTBCMicroFastPayOptions {
  merchantId: string; // CTBC 配發之商店代碼
  txnKey: string; // MAC/TXN 使用的金鑰（商店自管）
  baseUrl?: string; // API base URL，預設為 https://ccapi.ctbcbank.com
  withServer?: boolean; // 是否使用後端伺服器自動產生 bindingURL
}

export interface CTBCResponsePayload {
  Header: {
    ServiceName: 'TokenAdd';
    Version: '1.0';
    ResponseTime: string; // yyyy/MM/dd+HH:mm:ss (UTC+8)
    MerchantID: string;
    RequestNo: string; // 綁卡交易序號
  };
  Data: {
    MAC: string; // 驗證用雜湊碼（MAC）
    TXN: string; // 綁卡回傳資料（加密）
  };
}

export interface CTBCRequestPrepareBindCardOptions {
  finishRedirectURL?: string;
  requestId?: string;
  promoCode?: string; // 活動代碼（可選）
  Pid?: string; // 身分證字號（可選）
  PhoneNum?: string; // 手機號碼（可選）
  PhoneNumEditable?: '0' | '1'; // 手機號碼是否允許使用者修改（0: 否, 1: 是）
  Birthday?: Date;
}

/**
 * 綁卡請求 payload，對應文件 §5.4 Token 店專用-新增卡片 的 TXN 欄位
 */
export interface CTBCBindCardRequestPayload {
  MerID: string; // 商店代碼（CTBC 配發之商店代號）
  MemberID: string; // 綁定會員編號（由商店自行定義）
  RequestNo: string; // 綁卡交易序號（商店自行產生、需唯一）
  TokenURL: string; // 綁卡完成時 CTBC 回傳通知的網址（需支援 POST）

  PromoCode?: string; // 活動代碼（可選）
  Pid?: string; // 身分證字號（可選）
  PhoneNum?: string; // 手機號碼（可選）
  PhoneNumEditable?: '0' | '1'; // 手機號碼是否允許使用者修改（0: 否, 1: 是）
  Birthday?: string; // MMDDYYYY 格式的生日（可選）
}

/**
 * 綁卡完成後，CTBC 回傳的資料結構，對應文件 §4.2.1 新增卡片 Response
 */
export interface CTBCBindCardCallbackPayload {
  cardToken: string; // 綁卡後產出的 Token 值（未來支付用）
  cardNoMask: string; // 卡號前六後四 (0000-00**-****-0000)
  requestNo: string;
}

/**
 * 綁卡請求狀態枚舉
 */
export enum CTBCBindCardRequestState {
  INITED = 'INITED', // 綁卡請求已初始化，但尚未產生表單
  FORM_GENERATED = 'FORM_GENERATED', // 已產生 form HTML，但尚未完成綁卡
  BOUND = 'BOUND', // 綁卡成功，收到 CardToken
  FAILED = 'FAILED', // 綁卡失敗
}

export interface CTBCRawRequest {
  Request: {
    Header: {
      ServiceName: 'PayJSON'; // 服務名稱（固定）
      Version: '1.0'; // 版本號（預設為 1.0）
      MerchantID: string; // 商店代碼（可能為空）
      RequestTime: string; // 回傳時間，格式 yyyy/MM/dd HH:mm:ss
    };
    Data: {
      MAC: string; // 驗證用雜湊碼（MAC）
      TXN: string; // 綁卡回傳資料（加密）
    };
  };
}

/**
 * CTBC rspjsonpwd 解出來後的最外層結構（內含 TXN/MAC）
 */
export interface CTBCRawResponse {
  Response: {
    Header: {
      ServiceName: 'TokenAdd'; // 服務名稱（固定）
      Version?: string; // 版本號（預設為 1.0）
      MerchantID?: string; // 商店代碼（可能為空）
      ResponseTime: string; // 回傳時間，格式 yyyy/MM/dd HH:mm:ss
    };
    Data: {
      MAC: string; // 驗證用雜湊碼（MAC）
      TXN: string; // 綁卡回傳資料（加密）
    };
  };
}

export interface CTBCOrderCommitPayload {
  MerID: string; // 商店代碼（由 CTBC 配發）
  MemberID: string; // 綁定會員編號（與綁卡時相同）
  RequestNo: string; // 訂單編號（唯一、對應交易）
  Token: string; // 綁卡成功取得的卡片 Token
  PurchAmt: number; // 訂單金額（單位：元）

  OrderDesc?: string; // 商品說明（可選）
  ProdCode?: string; // 商品代碼（可選）
  PromoCode?: string; // 活動代碼（可選）
  Lidm?: string; // 訂單追蹤碼（平台側可選）
  NumberOfPay?: number; // 分期付款期數（若有支援分期）
  SubMerchantID?: string; // 子商店代碼（若 CTBC 有提供）
  TerminalID?: string; // 端末機代碼（若 CTBC 有提供）
}

export interface CTBCOrderCommitResultPayload {
  MerchantID: string; // 商店代碼
  MerID: string; // 商店代號（與送出一致）
  MemberID: string; // 綁卡會員編號
  RequestNo: string; // 訂單編號（對應交易序號）

  StatusCode: string; // 交易狀態碼（00 表示成功）
  StatusDesc: string; // 交易訊息說明
  AuthCode?: string; // 授權碼（交易成功時才有）
  ECI?: string; // 電子商務交易指標（非 3D 固定值）
  OrderNo?: string; // 銀行端交易編號（可作為 platformTradeNumber）
  ResponseTime: string; // yyyy/MM/dd HH:mm:ss 格式的交易完成時間
}

/**
 * 訂單狀態流轉圖：
 *
 *    [INITED]                            // 訂單已建立，尚未請款
 *       │
 *       │ commit()
 *       ▼
 *    [COMMITTED] ←── StatusCode === '00'（請款成功）
 *       ▲
 *       │
 *       └── markFailed() ←── StatusCode !== '00' 或 MAC 驗證失敗等錯誤
 *            ▼
 *         [FAILED]                      // 請款失敗，包含驗證失敗、HTTP 錯誤等
 */
export enum CTBCOrderState {
  INITED = 'INITED',
  COMMITTED = 'COMMITTED',
  FAILED = 'FAILED',
}

// 內部用於組合加密字串的 payload 統一格式
export type CTBCTxnPayload = Record<string, string | number | undefined>;

export interface CTBCOrderCommitResult {
  success: boolean; // 是否請款成功
  orderNo?: string; // 銀行端訂單號（請款成功才有）
  error?: {
    code: string; // 錯誤代碼（MAC_FAIL、CTBC status code、HTTP code 等）
    message: string; // 錯誤說明
  };
}

// 為符合 PaymentGateway 的 commit() 型別要求，擴充必要欄位
export interface CTBCOrderCommitMessage extends OrderCreditCardCommitMessage {}

// 提供 prepare() 時所需的訂單建立資料，實際執行時會從 input cast 而來
export interface CTBCOrderInput {
  id: string;
  memberId: string;
  cardToken: string;
  totalPrice: number;
}

export interface CTBCCheckoutWithBoundCardOptions extends CheckoutWithBoundCardOptions {
  cardId: string; // 綁定的卡片 ID
  memberId: string; // 綁定會員 ID
  items: PaymentItem[];
  orderId?: string;
}

export interface CTBCCheckoutWithBoundCardRequestPayload {
  MerID: string;
  MemberID: string;
  TerminalID: string;
  Lidm: string; // 訂單追蹤碼
  PurchAmt: number;
  TxType: 0 | 1 | 2; // 0: 一般交易, 1: 分期付款, 2: 紅利抵扣
  NumberOfPay?: number; // 分期付款期數（若 TxType 為 1 時必填）
  ProdCode?: number; // 產品代碼
  MerchantName?: string; // 商店名稱
  Customize?: '1' | '2' | '3' | '4' | '5'; // 自訂化選項（1: 繁體中文, 2: 簡體中文, 3: 英文, 4: 日文, 5: 其他）
  AuthResURL: string;
  AutoCap: 0 | 1; // 是否自動請款（0: 否, 1: 是）
  SubMerchantID?: string; // 子商店代碼（可選）
  OrderDesc?: string; // 訂單描述（可選）
  Pid?: string; // 身分證字號（可選）
  Birthday?: string; // 生日（MMDDYYYY 格式，可選）
  RequestNo: string;
  Token: string;
  PromoCode?: string; // 活動代碼（可選）
}

export interface CTBCCheckoutWithBoundCardResponsePayload {
  AuthAmount: number;
  AuthCode: string; // 授權碼
  Authrrpid: string; // 授權回覆 ID
  CapBatchId: string; // 請款批次 ID
  CardNo: string; // 授權碼
  CardNumber: string; // 卡號（前六後四）
  EInvoice: 1 | 0; // 是否開立電子發票（1: 是, 0: 否）
  Errcode: string; // 錯誤代碼（00: 成功）
  Last4DigitPAN: string; // 最後四位卡號
  Lidm: string; // 訂單追蹤碼
  MemberID: string; // 綁定會員 ID
  MerID: string; // 商店代號
  MerchantID: string; // 商店 ID
  RequestNo: string; // 訂單編號
  Status: string; // 交易狀態（0: 成功）
  StatusCode: string; // 交易狀態碼（I0000: 成功）
  TermSeq: string; // 端末機序號
  Xid: string; // 交易 ID
}

export interface CTBCInMacRequestPayload {
  MerchantID: string;
  TerminalID: string;
  lidm: string;
  purchAmt: number;
  txType: '0' | '1' | '2' | '4' | '6'; // 0: 一般交易, 1: 分期付款, 2: 紅利抵扣, 4: 紅利分期, 6: AE
  Option: string; // 1 為一般特店，美運時帶空字串
  Key: string;
}

// POS API 常數定義 - 對應 PHP util.php 中的錯誤代碼
export const CTBC_ERROR_CODES = {
  ERR_INVALID_LIDM: 268435457,
  ERR_INVALID_PAN: 268435458,
  ERR_INVALID_EXP_DATE: 268435459,
  ERR_INVALID_PURCH_AMT: 268435460,
  ERR_INVALID_CURRENCY: 268435461,
  ERR_INVALID_CAVV: 268435462,
  ERR_JSON_DECODE_FAILED: 268435463,
  ERR_INVALID_XID: 268435464,
  ERR_INVALID_AUTH_RRPID: 268435465,
  ERR_INVALID_ORDERDESC: 268435466,
  ERR_INVALID_RECUR_NUM: 268435467,
  ERR_INVALID_BIRTHDAY: 268435468,
  ERR_INVALID_PID: 268435469,
  ERR_INVALID_PROD_CODE: 268435470,
  ERR_AMOUNT_OVER_LIMIT: 268435471,
  ERR_INVALID_AUTH_CODE: 268435472,
  ERR_INVALID_ORG_AMT: 268435473,
  ERR_INVALID_EXPONENT: 268435475,
  ERR_INVALID_BATCH_SEQ: 268435476,
  ERR_INVALID_BATCH_ID: 268435477,
  ERR_INVALID_MERID: 268435478,
  ERR_INVALID_ECI: 268435479,
  ERR_INVALID_RECUR_PARAM: 268435480,
  ERR_INVALID_TX_TYPE: 268435481,
  ERR_INVALID_USER_NAME: 268435483,
  ERR_ORIGINAL_AMT_MISMATCH: 268435484,
  ERR_HOST_CONNECTION_FAILED: 12,
  ERR_RESPONSE_PARSE_FAILED: 268435473,
} as const;

// POS API 配置介面
export interface CTBCPosApiConfig {
  URL: string;
  MacKey: string;
}

// POS API 基本參數
export interface CTBCPosApiBaseParams {
  MERID: string;
  'LID-M': string;
}

// 查詢 API 參數
export interface CTBCPosApiQueryParams extends CTBCPosApiBaseParams {
  TxType?: string;
  TxID?: string;
  Tx_ATTRIBUTE?: 'TX_AUTH' | 'TX_SETTLE' | 'TX_VOID' | 'TX_REFUND';
}

// 退款 API 參數
export interface CTBCPosApiRefundParams extends CTBCPosApiBaseParams {
  XID: string;
  AuthCode: string;
  OrgAmt: string;
  PurchAmt: string;
  currency?: string;
  exponent?: string;
}

// POS API 授權取消參數 (Reversal)
export interface CTBCPosApiReversalParams extends CTBCPosApiBaseParams {
  XID: string;
  AuthCode: string;
  OrgAmt: string;
  AuthNewAmt: string;
  currency?: string;
  exponent?: string;
}

// POS API 請款取消參數 (CapRev)
export interface CTBCPosApiCapRevParams extends CTBCPosApiBaseParams {
  XID: string;
  AuthCode: string;
  OrgAmt: string;
  CapRevAmt: string;
  currency?: string;
  exponent?: string;
}

// 退款撤銷 API 參數
export interface CTBCPosApiCancelRefundParams extends CTBCPosApiBaseParams {
  XID: string;
  AuthCode: string;
  CredRevAmt: string;
  currency?: string;
  exponent?: string;
}

// POS API 回應介面
export interface CTBCPosApiResponse {
  RespCode: string;
  ApiVersion?: string;
  currency?: string;
  amount?: string;
  exponent?: string;
  ErrorDesc?: string;
  // 查詢相關欄位
  CurrentState: string;
  SwRevision?: string;
  QueryCode?: string;
  ErrStatus?: string;
  ERRDESC?: string;
  QueryError?: string;
  ErrCode?: string;
  VERSION?: string;
  Txn_date?: string;
  Txn_time?: string;
  AuthCode?: string;
  AuthAmt?: string;
  PAN?: string;
  ECI?: string;
  XID?: string;
  // 退款相關欄位
  RefAmt?: string;
  // 取消退款相關欄位
  RetrRef?: string;
  ResAmt?: string;
  BatchID?: string;
  BatchSeq?: string;
  TermSeq?: string;
  // amex取消退款相關欄位
  capBatchSeq?: string;
  capBatchId?: string;
  unCredAmt?: string;
  aetId?: string;
  [key: string]: string | undefined;
}

// AMEX SOAP API 配置介面
export interface CTBCAmexConfig {
  wsdlUrl: string;
  timeout?: number;
  sslOptions?: {
    key?: string;
    cert?: string;
    ca?: string | string[];
    rejectUnauthorized?: boolean;
    [key: string]: unknown;
  };
}

// AMEX 查詢參數
export interface CTBCAmexInquiryParams {
  merId: string;
  lidm: string;
  xid?: string;
  IN_MAC_KEY?: string; // MAC Key 是可選的，根據文檔說明
}

// AMEX 退款參數
export interface CTBCAmexRefundParams {
  merId: string;
  xid: string;
  lidm: string;
  purchAmt: number;
  orgAmt: number;
  IN_MAC_KEY: string;
}

// // AMEX 請款參數 (Cap)
// export interface CTBCAmexCaptureParams {
//   merId: string;
//   xid: string;
//   lidm: string;
//   actionAmt: number;
//   orgAmt: number;
//   IN_MAC_KEY: string;
// }

// AMEX 取消退款參數 (CredRev)
export interface CTBCAmexCancelRefundParams {
  merId: string;
  xid: string;
  lidm: string;
  capBatchId: string;
  capBatchSeq: string;
  IN_MAC_KEY: string;
}

// AMEX 授權取消參數 (AuthRev)
export interface CTBCAmexAuthRevParams {
  merId: string;
  xid: string;
  lidm: string;
  purchAmt: number;
  orgAmt: number;
  IN_MAC_KEY: string;
}

// AMEX 請款取消參數 (CapRev)
export interface CTBCAmexCapRevParams {
  merId: string;
  xid: string;
  lidm: string;
  purchAmt: number;
  orgAmt: number;
  IN_MAC_KEY: string;
}

// AMEX API 回應介面 (查詢用)
export interface CTBCAmexInquiryResponse {
  count: number;
  mac: string;
  errCode: string;
  errDesc: string;
  poDetails: Array<{
    aetId?: string;
    xid?: string;
    authCode?: string;
    termSeq?: string;
    purchAmt?: string;
    authAmt?: string;
    currency?: string;
    status?: string;
    txnType?: string;
    expDate?: string;
    errCode?: string;
    errDesc?: string;
  }>;
}

// AMEX API 回應介面 (退款用)
export interface CTBCAmexRefundResponse {
  aetId: string;
  xid: string;
  credAmt: string;
  unCredAmt: string;
  capBatchId: string;
  capBatchSeq: string;
  errCode: string;
  errDesc: string;
  mac: string;
}

// AMEX 通用回應類型
export type CTBCAmexResponse = CTBCAmexInquiryResponse | CTBCAmexRefundResponse;

// AMEX 取消退款回應 (CredRev)
export interface CTBCAmexCancelRefundResponse {
  aetId: string;
  xid: string;
  errCode: string;
  errDesc: string;
  mac: string; // 'Y' | 'F' | 'N'
}

// SOAP 操作的參數介面
export interface SoapRequestData {
  merId: string;
  lidm: string;
  xid?: string;
  credAmt?: number;
  capBatchId?: string;
  capBatchSeq?: string;
  IN_MAC_KEY?: string;
  [key: string]: unknown;
}

// SOAP 回應的詳細資料項目
export interface AmexPoDetailItem {
  aetid?: string;
  aetId?: string;
  xid?: string;
  authCode?: string;
  termSeq?: string;
  purchAmt?: string;
  authAmt?: string;
  currency?: string;
  status?: string;
  txnType?: string;
  expDate?: string;
  errCode?: string;
  errDesc?: string;
  pan?: string;
  lidm?: string;
}

// SOAP 回應結果
export interface SoapInquiryResult {
  count?: number;
  errCode?: string;
  errDesc?: string;
  mac?: string;
  poDetails?: AmexPoDetailItem[] | AmexPoDetailItem;
  aetId?: string;
  xid?: string;
  credAmt?: string;
  unCredAmt?: string;
  capBatchId?: string;
  capBatchSeq?: string;
}

// SOAP 調用回應結構
export interface SoapResponse {
  inquiryReturn?: SoapInquiryResult;
  refundReturn?: SoapInquiryResult;
  [key: string]: unknown;
}
