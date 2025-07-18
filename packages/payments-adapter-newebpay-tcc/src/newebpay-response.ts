/**
 * NewebPay Response helpers
 * --------------------------------------------------
 * 封裝所有 NPA-B101 / B102 / B103 / B104（以及 P1 前台回傳）
 * 的解密與雜湊驗證邏輯，統一暴露兩個函式：
 *
 * 1. decodeTradeInfo  –  處理 P1 (NPA-F011) 或 B101/B102 直接回傳的
 *    { TradeInfo, TradeSha } 欄位。
 *
 * 2. decodeEncryptData – 處理 B101/B102/B103/B104 HTTP JSON 回傳包裝：
 *    {
 *      Status,
 *      Message,
 *      Result: { EncryptData, HashData }
 *    }
 *
 * 兩者皆在通過 SHA-256 驗證後，解開 AES，並回傳物件 (Record<string,string>)。
 */

import { EncodeOptions } from './newebpay-crypto';
import { decodePayload } from './newebpay-crypto';
import { HttpResponse } from './typings';

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

/** 任何帶有 EncryptData / HashData 的結果包裝 */
interface EncryptedResult {
  EncryptData: string;
  HashData: string;
}

/** 任何帶有 TradeInfo / TradeSha 的結果包裝 */
interface TradeInfoEnvelope {
  TradeInfo: string;
  TradeSha: string;
}

/* ------------------------------------------------------------------ */
/* Core helpers */
/* ------------------------------------------------------------------ */

/**
 * Decode P1 / B101 / B102 回傳的 TradeInfo & TradeSha
 */
export function decodeTradeInfo(
  env: TradeInfoEnvelope,
  opts: EncodeOptions,
): Record<string, string> {
  return decodePayload(env.TradeInfo, env.TradeSha, opts);
}

/**
 * Decode JSON 包裝層的 EncryptData & HashData
 *
 * @throws Error  若 SHA-256 驗證失敗或 HTTP Status != SUCCESS
 */
export function decodeEncryptData<T extends EncryptedResult = EncryptedResult>(
  apiResp: HttpResponse<T>,
  opts: EncodeOptions,
): Record<string, string> {
  if (apiResp.Status !== 'SUCCESS')
    throw new Error(`NewebPay Status=${apiResp.Status} (${apiResp.Message})`);

  const { EncryptData, HashData } = apiResp.Result;

  return decodePayload(EncryptData, HashData, opts);
}