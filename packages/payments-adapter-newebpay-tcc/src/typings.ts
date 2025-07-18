import { OrderCommitMessage } from '@rytass/payments';

export interface TradeInfoResult {
  TradeInfo: string;
  TradeSha: string;
  EncryptType: 0 | 1;
}
export interface PostDataResult {
  PostData_: { EncryptData: string; HashData: string };
  EncryptType_: 0 | 1;
}

/** 綁卡請求狀態 */
export enum NewebPayBindCardRequestState {
  INITED = 'INITED',
  FORM_GENERATED = 'FORM_GENERATED',
  BOUND = 'BOUND',
  FAILED = 'FAILED',
}

/** P1 前台幕前綁卡所需主要欄位 (部分選填欄位省略) */
export interface NewebPayBindCardRequestPayload {
  MerchantID: string;
  RespondType: 'JSON' | 'String';
  TimeStamp: number | string;
  Version: '2.1';
  MerchantOrderNo: string;
  Amt: number;
  ItemDesc: string;
  CREDITAGREEMENT: 1; // 固定帶 1
  TokenTerm: string;
  // 可選欄位
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
  [key: string]: string | number | undefined;
}

export type NewebPayBindCardRequestInput = {
  MerchantOrderNo: string;
  Amt: number;
  ItemDesc: string;
  CREDITAGREEMENT: 1;
  TokenTerm: string;
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

/** 綁卡 callback 主要欄位 (NPA-F011 回傳) */
export interface NewebPayBindCardCallbackPayload {
  Status: 'SUCCESS' | string;
  MerchantID: string;
  TradeInfo: string;
  TradeSha: string;
  Version: string;
}

/** 解析 TradeInfo 後的 Result 片段 (最常用欄位) */
export interface NewebPayBindCardResult {
  TokenTerm: string;
  TokenValue: string;
  MerchantOrderNo: string;
  Card6No: string;
  Card4No: string;
  PayTime: string; // yyyy-MM-dd HH:mm:ss
}

export interface NewebPayPaymentOptions {
  merchantId: string;         // 藍新配發之商店代碼
  aesKey: string;             // 藍新配發之金鑰 (AES 使用)
  aesIv: string;              // IV 向量，與金鑰配對
  encryptType?: 0 | 1;        // 0 = AES/CBC (預設), 1 = AES/GCM
  baseUrl?: string;           // API base URL，預設為 https://ccore.newebpay.com
}

export interface HttpResponse<T = any> {
  Status: string;
  Message: string;
  Result: T;
}

/** NPA-B103 query result wrapper (EncryptData/HashData) */
export interface QueryBindCardResult {
  EncryptData: string;
  HashData: string;
}

/** NPA-B104 unbind result wrapper (EncryptData/HashData) */
export interface UnbindCardResult {
  EncryptData: string;
  HashData: string;
}

export interface NewebPayOrderInput {
  MerchantOrderNo: string;    // 商店訂單編號
  Amt: number;                // 交易金額
  ItemDesc: string;           // 商品描述
  Email?: string;             // 顧客 Email
  TokenValue: string;         // 綁卡後取得的 TokenValue
  TokenTerm: string;          // 商店傳入的綁卡識別值
  P3D?: 0 | 1;                // 是否使用 3D 驗證
  Stage?: number;             // 分期期數
  RespondType?: 'JSON' | 'String';
  TimeStamp?: number;
  Version?: string;
  [key: string]: any;
}

export interface NewebPayOrderCommitResult {
  success: boolean;
  tradeNo?: string;
  payTime?: string;
  error?: {
    code: string;
    message: string;
  };
}

/** 回傳 EncryptData 解密後常用欄位 (最小子集) */
export interface PnEncryptData {
  MerchantOrderNo: string;
  TradeNo: string;
  PayTime: string; // yyyy-MM-dd HH:mm:ss
  Status: string; // SUCCESS or code
  Message: string;
}

export interface NewebPayOrderCommitMessage extends OrderCommitMessage {
  tokenTerm: string;
  tokenValue: string;
}
