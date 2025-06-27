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

import { OrderCommitMessage } from '@rytass/payments';
import { EventEmitter } from 'node:events';

export interface BindCardGatewayLike<T = any> {
  baseUrl: string; // 綁卡跳轉與 API endpoint 所屬網域
  emitter: EventEmitter; // 綁卡結果事件派發器
  getBindingURL(request: T): string; // 取得綁卡跳轉用 URL
  queryBoundCard(memberId: string): Promise<{ expireDate: Date }>; // 查詢綁定卡片資訊（尚未實作）
}

export interface CTBCMicroFastPayOptions {
  merchantId: string; // CTBC 配發之商店代碼
  txnKey: string; // MAC/TXN 使用的金鑰（商店自管）
  baseUrl?: string; // API base URL，預設為 https://ccapi.ctbcbank.com
  withServer?: boolean; // 是否使用後端伺服器自動產生 bindingURL
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
}

/**
 * 綁卡完成後，CTBC 回傳的資料結構，對應文件 §4.2.1 新增卡片 Response
 */
export interface CTBCBindCardCallbackPayload {
  MerchantID: string; // 商店代碼（應與 MerID 相同）
  MerID: string; // 商店代碼
  BindMerID: string; // 綁卡商店代號（通常與 MerID 相同）
  MemberID: string; // 會員編號（綁定對象）
  RequestNo: string; // 綁卡交易序號（與送出時一致）

  CardToken: string; // 綁卡後產出的 Token 值（未來支付用）
  CardNoMask: string; // 遮罩後的卡號（ex: 411111******1111）
  CardType: string; // 卡別（如：信用卡、VISA、MASTER）
  StatusCode: string; // 綁卡狀態代碼（'00' 表成功）
  StatusDesc: string; // 狀態說明（如成功/失敗原因）
  ResponseTime: string; // 回應時間，格式為 yyyy/MM/dd HH:mm:ss
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

/**
 * CTBC rspjsonpwd 解出來後的最外層結構（內含 TXN/MAC）
 */
export interface CTBCRawResponse {
  Response: {
    Header: {
      ServiceName: string; // 服務名稱（固定）
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
export interface CTBCOrderCommitMessage extends OrderCommitMessage {
  memberId: string;
  cardToken: string;
}

// 提供 prepare() 時所需的訂單建立資料，實際執行時會從 input cast 而來
export interface CTBCOrderInput {
  id: string;
  memberId: string;
  cardToken: string;
  totalPrice: number;
}
