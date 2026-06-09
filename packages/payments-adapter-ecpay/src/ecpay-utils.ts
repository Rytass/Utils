import { createHash } from 'crypto';

export function ecpayUrlEncode(raw: string): string {
  return encodeURIComponent(raw).toLowerCase().replace(/'/g, '%27').replace(/~/g, '%7e').replace(/%20/g, '+');
}

export function ecpaySha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex').toUpperCase();
}

// ECPay 票證系統「檢查碼機制」的唯一實作來源（production 與測試共用，避免兩處各寫一份而漂移）。
// 對「加密前的原始明文字串」計算：ToUpper(SHA256(URLEncode(HashKey 值 + 明文 + HashIV 值)))，
// 無欄位名前綴、無 &。注意：此公式僅適用於票證 API，與一般 AIO 金流的參數排序式 MAC 不同。
// 參考：https://developers.ecpay.com.tw/?p=29998
export function computeTicketCheckMacValue(plaintext: string, creds: { hashKey: string; hashIv: string }): string {
  return ecpaySha256(encodeURIComponent(`${creds.hashKey}${plaintext}${creds.hashIv}`).toLowerCase());
}
