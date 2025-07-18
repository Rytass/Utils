/*
 * NewebPay Crypto – Request / Response helpers
 * --------------------------------------------------
 * Transforms a field object → ASCII-sorted → URL query string
 *   ├── AES encryption (EncryptData / TradeInfo)
 *   └── SHA256 hashing (HashData / TradeSha)
 * Parses response: verify hash → decrypt AES → convert back to object
 */

import { encryptAES, decryptAES, generateHashData, sha256Hex, AesMode } from './newebpay-crypto-core';
import { EncodeOptions, EncodeResult, PostDataResult, TradeInfoResult } from './typings';

/**
 * Converts an object into an ASCII-sorted URL query string (k1=v1&k2=v2…)
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

/**
 * For P1 (Frontend) – generates TradeInfo + TradeSha
 */
export function buildTradeInfo(payload: Record<string, unknown>, opts: EncodeOptions):TradeInfoResult {
  const { encrypted, hash } = encodePayload(payload, opts);

  return { TradeInfo: encrypted, TradeSha: hash, EncryptType: opts.encryptType ?? 0 };
}

/**
 * For P1/Pn (Backend) – generates PostData_ with EncryptData_ and HashData_
 */
export function buildPostData(payload: Record<string, unknown>, opts: EncodeOptions):PostDataResult {
  const { encrypted, hash } = encodePayload(payload, opts);

  return {
    PostData_: { EncryptData: encrypted, HashData: hash },
    EncryptType_: opts.encryptType ?? 0,
  };
}

