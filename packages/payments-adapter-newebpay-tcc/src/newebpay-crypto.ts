/*
 * NewebPay Crypto – Request / Response helpers
 * --------------------------------------------------
 * 將欄位物件 → ASCII 排序 → URL 查詢字串
 *   ↳ AES 加密 (EncryptData / TradeInfo)
 *   ↳ SHA256 雜湊 (HashData / TradeSha)
 * 解析回傳：驗證 Hash → AES 解開 → 轉回物件
 */

import { encryptAES, decryptAES, generateHashData, sha256Hex, AesMode } from './newebpay-crypto-core';
import { PostDataResult, TradeInfoResult } from './typings';

// #region ──────────────────────── Types ─────────────────────────
export interface EncodeOptions {
  key: string; // 商店 Key
  iv: string;  // 商店 IV
  encryptType?: 0 | 1; // 0 = AES/CBC, 1 = AES/GCM (文件 EncryptType)
}

export interface EncodeResult {
  encrypted: string; // HEX (大寫)
  hash: string;      // SHA256 Hex (大寫)
}

// #endregion

// #region ──────────────────── Core Utilities ───────────────────

/**
 * 將物件轉為 ASCII 排序之 URL 字串 (k1=v1&k2=v2…)
 */
export function toSortedQuery(payload: Record<string, unknown>): string {
  return Object.entries(payload)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

/**
 * Encode payload for NewebPay (TradeInfo / EncryptData)
 */
export function encodePayload(payload: Record<string, unknown>, opts: EncodeOptions): EncodeResult {
  const query = toSortedQuery(payload);
  const mode: AesMode = opts.encryptType === 1 ? 'GCM' : 'CBC';
  const encryptedBuf = encryptAES(query, opts.key, opts.iv, mode);
  const encryptedHex = encryptedBuf.toString('hex').toUpperCase();
  const hash = generateHashData(encryptedHex, opts.key, opts.iv);

  return { encrypted: encryptedHex, hash };
}

/**
 * Decode and verify NewebPay response (EncryptData / TradeInfo)
 */
export function decodePayload(encryptedHex: string, hash: string, opts: EncodeOptions): Record<string, string> {
  const expectHash = generateHashData(encryptedHex, opts.key, opts.iv);

  if (expectHash !== hash.toUpperCase()) throw new Error('Hash verification failed');

  const mode: AesMode = opts.encryptType === 1 ? 'GCM' : 'CBC';
  const decryptedBuf = decryptAES(Buffer.from(encryptedHex, 'hex'), opts.key, opts.iv, mode);
  const query = decryptedBuf.toString('utf8');

  const obj: Record<string, string> = {};

  for (const kv of query.split('&')) {
    const [k, v] = kv.split('=');

    obj[k] = v;
  }

  return obj;
}

// #endregion

// #region ────────────────── High‑level wrappers ──────────────────

/**
 * For P1 (前台) – TradeInfo + TradeSha
 */
export function buildTradeInfo(payload: Record<string, unknown>, opts: EncodeOptions):TradeInfoResult {
  const { encrypted, hash } = encodePayload(payload, opts);

  return { TradeInfo: encrypted, TradeSha: hash, EncryptType: opts.encryptType ?? 0 };
}

/**
 * For P1/Pn (幕後) – PostData_ / EncryptData_/HashData_
 */
export function buildPostData(payload: Record<string, unknown>, opts: EncodeOptions):PostDataResult {
  const { encrypted, hash } = encodePayload(payload, opts);

  return {
    PostData_: { EncryptData: encrypted, HashData: hash },
    EncryptType_: opts.encryptType ?? 0,
  };
}

// #endregion
