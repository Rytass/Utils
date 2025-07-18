/*
 * NewebPay Crypto Core
 * --------------------------------------------------
 * Encapsulates low-level AES (CBC/GCM) encryption & SHA-256 hashing helpers
 * used across payments-adapter-newebpay-tcc.
 *
 * - AES key & IV come from NewebPay merchant backend ("Key", "IV").
 * - CBC mode uses PKCS#7 padding; GCM mode relies on built-in padding.
 * - All hex outputs are **uppercase** (NewebPay spec).
 */

import crypto from 'node:crypto';

export type AesMode = 'CBC' | 'GCM';

function pkcs7Pad(buf: Buffer, blockSize = 16): Buffer {
  const pad = blockSize - (buf.length % blockSize);

  return Buffer.concat([buf, Buffer.alloc(pad, pad)]);
}

function pkcs7Unpad(buf: Buffer): Buffer {
  const pad = buf[buf.length - 1];

  if (pad <= 0 || pad > 16) throw new Error('Invalid PKCS#7 padding');

  return buf.subarray(0, buf.length - pad);
}

/**
 * Produce SHA-256 hex (uppercase)
 */
export function sha256Hex(data: crypto.BinaryLike): string {
  return crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
}

export function encryptAES(
  plaintext: string | Buffer,
  key: string | Buffer,
  iv: string | Buffer,
  mode: AesMode = 'CBC',
): Buffer {
  const _key = typeof key === 'string' ? Buffer.from(key, 'utf8') : key;
  const _iv = typeof iv === 'string' ? Buffer.from(iv, 'utf8') : iv;
  const cipherName = mode === 'CBC' ? 'aes-256-cbc' : 'aes-256-gcm';

  const cipher = crypto.createCipheriv(
    cipherName,
    _key,
    _iv,
  ) as crypto.CipherGCM;

  let input =
    typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;

  if (mode === 'CBC') input = pkcs7Pad(input);

  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);

  return mode === 'GCM'
    ? Buffer.concat([encrypted, cipher.getAuthTag()])
    : encrypted;
}

export function decryptAES(
  ciphertext: Buffer,
  key: string | Buffer,
  iv: string | Buffer,
  mode: AesMode = 'CBC',
): Buffer {
  const _key = typeof key === 'string' ? Buffer.from(key, 'utf8') : key;
  const _iv = typeof iv === 'string' ? Buffer.from(iv, 'utf8') : iv;
  const cipherName = mode === 'CBC' ? 'aes-256-cbc' : 'aes-256-gcm';

  let data = ciphertext;
  let authTag: Buffer | undefined;

  if (mode === 'GCM') {
    authTag = data.subarray(data.length - 16);
    data = data.subarray(0, data.length - 16);
  }

  const decipher = crypto.createDecipheriv(
    cipherName,
    _key,
    _iv,
  ) as crypto.DecipherGCM;

  if (authTag) {
    (decipher as crypto.DecipherGCM).setAuthTag(authTag);
  }

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

  return mode === 'CBC' ? pkcs7Unpad(decrypted) : decrypted;
}

/**
 * Generates CheckCode (HashData / TradeSha) based on Appendix 4 algorithm.
 * Formula: SHA256(`HashKey=${key}&${hexStr}&HashIV=${iv}`) → hex
 *
 * @param encryptedHex  AES-encrypted **HEX string** (case-insensitive)
 */

export function generateHashData(
  encryptedHex: string,
  key: string,
  iv: string,
): string {
  const raw = `HashKey=${key}&${encryptedHex}&HashIV=${iv}`;

  return sha256Hex(raw).toUpperCase();
}
