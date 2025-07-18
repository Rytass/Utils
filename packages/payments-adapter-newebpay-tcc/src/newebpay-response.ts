/**
 * NewebPay Response Helpers
 * --------------------------------------------------
 * Encapsulates decryption and hash verification logic for responses from
 * NPA-B101 / B102 / B103 / B104 and the P1 frontend callback.
 *
 * Provides two unified utility functions:
 *
 * 1. decodeTradeInfo – Handles direct response with fields:
 *    { TradeInfo, TradeSha }, typically from P1 (NPA-F011) or B101/B102.
 *
 * 2. decodeEncryptData – Handles JSON-wrapped response from B101/B102/B103/B104:
 *    {
 *      Status,
 *      Message,
 *      Result: { EncryptData, HashData }
 *    }
 *
 * Both functions verify SHA-256 hash, decrypt the AES payload,
 * and return a flat object (Record<string, string>).
 */

import { decodePayload } from './newebpay-crypto';
import { EncodeOptions, HttpResponse } from './typings';

//Any response object containing EncryptData and HashData fields
interface EncryptedResult {
  EncryptData: string;
  HashData: string;
}

// Any response object containing TradeInfo and TradeSha fields
interface TradeInfoEnvelope {
  TradeInfo: string;
  TradeSha: string;
}

/* ------------------------------------------------------------------ */
/* Core helpers */
/* ------------------------------------------------------------------ */

/**
 * Decode TradeInfo & TradeSha returned from P1 / B101 / B102
 */
export function decodeTradeInfo(
  env: TradeInfoEnvelope,
  opts: EncodeOptions,
): Record<string, string> {
  return decodePayload(env.TradeInfo, env.TradeSha, opts);
}

/**
 * Decode JSON-wrapped EncryptData & HashData from B101/B102/B103/B104
 *
 * @throws Error if SHA-256 verification fails or HTTP Status !== 'SUCCESS'
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