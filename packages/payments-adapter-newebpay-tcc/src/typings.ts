import { OrderCommitMessage } from '@rytass/payments';

/** TradeInfo + TradeSha（前台提交時使用） */
export interface TradeInfoResult {
  TradeInfo: string; // AES 加密後的十六進位字串
  TradeSha: string; // 對應 HashKey + TradeInfo + HashIV 雜湊值
  EncryptType: 0 | 1; // 0=AES/CBC；1=AES/GCM
}

/** EncryptData + HashData（API 傳送時使用） */
export interface PostDataResult {
  PostData_: {
    EncryptData: string; // AES 加密後十六進位字串
    HashData: string; // SHA256 雜湊字串
  };
  EncryptType_: 0 | 1; // 0=CBC, 1=GCM
}

/** 綁卡請求狀態 */
export enum NewebPayBindCardRequestState {
  INITED = 'INITED', // 尚未產生表單
  FORM_GENERATED = 'FORM_GENERATED', // 已產生表單，待送出
  BOUND = 'BOUND', // 綁卡成功
  FAILED = 'FAILED', // 綁卡失敗
}

/** P1 前台幕前綁卡所需主要欄位（依文件 NPA-F011） */
export interface NewebPayBindCardRequestPayload {
  MerchantID: string; // 商店代碼（由藍新提供）
  RespondType: 'JSON' | 'String'; // 回傳格式
  TimeStamp: number | string; // 時間戳記（UNIX 秒）
  Version: '2.1'; // API 版本
  MerchantOrderNo: string; // 商店訂單編號
  Amt: number; // 授權金額（最少為 1）
  ItemDesc: string; // 商品描述
  CREDITAGREEMENT: 1; // 固定傳 1，啟用約定交易
  TokenTerm: string; // 商店綁卡識別值（自訂）
  // 以下為選填欄位（依文件註明）
  ReturnURL?: string; // 交易完成後跳轉頁（前台）
  NotifyURL?: string; // 綁卡完成後伺服器通知 URL
  ClientBackURL?: string; // 用戶取消時返回頁面
  Email?: string; // 使用者 Email
  EmailModify?: 0 | 1; // 是否允許修改 Email
  TokenLife?: string; // Token 有效天數（預設永久）
  UseFor?: 0 | 1 | 2; // 綁卡用途：0=不限, 1=定期, 2=非定期
  MobileVerify?: 0 | 1 | 2; // 手機驗證選項
  MobileNumber?: string; // 手機號碼（限台灣門號）
  MobileNumberModify?: 0 | 1; // 是否允許修改手機
  [key: string]: string | number | undefined; // 保留彈性欄位
}

/** 前台綁卡請求輸入（可缺省部分欄位） */
export type NewebPayBindCardRequestInput = {
  MerchantOrderNo: string; // 訂單編號
  Amt: number; // 金額
  ItemDesc: string; // 描述
  CREDITAGREEMENT: 1; // 固定傳 1
  TokenTerm: string; // 綁卡識別碼
  ReturnURL?: string;
  NotifyURL?: string;
  ClientBackURL?: string;
  Email?: string;
  EmailModify?: 0 | 1;
  TokenLife?: string;
  UseFor?: 0 | 1 | 2;
  MobileVerify?: 0 | 1 | 2;
  MobileNumber?: string;
  MobileNumberModify?: 0 | 1;
  RespondType?: 'JSON' | 'String';
  Version?: '2.1';
  TimeStamp?: number | string;
};

/** P1 綁卡完成後（NotifyURL 回傳）的 callback 主體欄位 */
export interface NewebPayBindCardCallbackPayload {
  Status: 'SUCCESS' | string; // 綁卡狀態
  MerchantID: string; // 商店代碼
  TradeInfo: string; // AES 加密後資料
  TradeSha: string; // SHA256 雜湊值
  Version: string; // API 版本
}

/** 解析 TradeInfo 解開後的常用欄位（綁卡成功回傳） */
export interface NewebPayBindCardResult {
  TokenTerm: string; // 商店自訂綁卡識別碼
  TokenValue: string; // 綁卡成功後回傳的 Token
  MerchantOrderNo: string; // 原始訂單編號
  Card6No: string; // 卡號前六碼
  Card4No: string; // 卡號後四碼
  PayTime: string; // 綁卡完成時間 yyyy-MM-dd HH:mm:ss
}

/** Gateway 初始化參數 */
export interface NewebPayPaymentOptions {
  merchantId: string; // 商店代碼（由藍新提供）
  aesKey: string; // 加解密使用金鑰
  aesIv: string; // 加解密使用 IV
  encryptType?: 0 | 1; // 0=AES/CBC (預設), 1=AES/GCM
  baseUrl?: string; // API base URL（預設 https://ccore.newebpay.com）
}

/** 所有 NewebPay API 通用的 Response 包裝格式 */
export interface HttpResponse<T = any> {
  Status: string; // 狀態：SUCCESS 或錯誤代碼
  Message: string; // 錯誤訊息或成功描述
  Result: T; // 內部加密資料或物件
}

/** NPA-B103 查詢綁卡狀態回傳結果 */
export interface QueryBindCardResult {
  EncryptData: string; // 加密資料
  HashData: string; // 雜湊驗證值
}

/** NPA-B104 解綁回傳結果 */
export interface UnbindCardResult {
  EncryptData: string;
  HashData: string;
}

/** 後續約定付款（NPA-B102）請求輸入 */
export interface NewebPayOrderInput {
  MerchantOrderNo: string; // 訂單編號
  Amt: number; // 金額
  ItemDesc: string; // 描述
  Email?: string; // 顧客 Email
  TokenValue: string; // 綁卡後取得的 TokenValue
  TokenTerm: string; // 商店自定的 TokenTerm
  P3D?: 0 | 1; // 是否使用 3D 驗證（0=否）
  Stage?: number; // 分期期數（若使用）
  RespondType?: 'JSON' | 'String';
  TimeStamp?: number; // 時間戳記（UNIX 秒）
  Version?: string; // API 版本
  [key: string]: any; // 其他欄位
}

/** 後續付款回傳結果封裝 */
export interface NewebPayOrderCommitResult {
  success: boolean; // 是否成功
  tradeNo?: string; // 藍新交易編號
  payTime?: string; // 扣款完成時間
  error?: {
    code: string; // 錯誤代碼
    message: string; // 錯誤說明
  };
}

/** 解開 EncryptData 之後常見欄位集合 */
export interface PnEncryptData {
  MerchantOrderNo: string; // 訂單編號
  TradeNo: string; // 藍新交易編號
  PayTime: string; // 扣款時間 yyyy-MM-dd HH:mm:ss
  Status: string; // SUCCESS 或錯誤代碼
  Message: string; // 說明文字
}

/** Commit 後封裝的訊息（for Adapter event） */
export interface NewebPayOrderCommitMessage extends OrderCommitMessage {
  tokenTerm: string; // 商店傳入綁卡識別值
  tokenValue: string; // 藍新回傳之 Token 值
}

/** NewebPayOrder 狀態列舉 */
export enum NewebPayOrderState {
  INITED = 'INITED',
  COMMITTED = 'COMMITTED',
  FAILED = 'FAILED',
}
