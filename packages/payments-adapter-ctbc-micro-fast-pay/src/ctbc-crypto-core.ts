import crypto from 'node:crypto';
import { CTBCInMacRequestPayload } from './typings';

// Default IV fixed for CTBC compatibility (not secret)
let IV: Buffer = Buffer.alloc(8, 0);

export let SSLAuthIV: Buffer = Buffer.from('hywebpg5', 'utf8'); // Default IV for SSLAuth, can be overridden

/**
 * Override default IV used for 3DES encryption.
 * Default IV is 8 zero-bytes as required by CTBC API.
 * Useful for testing or other bank integrations.
 */
export function setIV(iv: Buffer): void {
  if (iv.length !== 8) throw new Error('IV must be 8 bytes');
  IV = iv;
}

export function setSSLAuthIV(iv: Buffer): void {
  if (iv.length !== 8) throw new Error('SSLAuth IV must be 8 bytes');

  SSLAuthIV = iv;
}

export function getMacFromParams(params: CTBCInMacRequestPayload): string {
  const buffer = Buffer.from(
    `|${[params.MerchantID, params.TerminalID, params.lidm, params.purchAmt, params.txType, params.Option].join('|')}|`,
    'utf8',
  );

  return desMac(buffer, params.Key);
}

export function desMac(message: Buffer, key: string): string {
  const blockSize = 8;
  const padLength = blockSize - (message.length % blockSize);
  const padding = Buffer.alloc(padLength, padLength);
  const paddedMsg = Buffer.concat([message, padding]);

  const cipher = crypto.createCipheriv('des-ede3-cbc', Buffer.from(key, 'utf8'), SSLAuthIV);

  cipher.setAutoPadding(false);

  const encrypted = Buffer.concat([cipher.update(paddedMsg), cipher.final()]);

  return encrypted.toString('hex').toUpperCase();
}

const xorBuffers = (buf1: Buffer, buf2: Buffer): Buffer => {
  const len = Math.min(buf1.length, buf2.length);
  const result = Buffer.allocUnsafe(len);

  for (let i = 0; i < len; i++) {
    result[i] = buf1[i] ^ buf2[i];
  }

  return result;
};

const pkcs5Pad = (buf: Buffer, blockSize: number): Buffer => {
  const pad = blockSize - (buf.length % blockSize);

  return Buffer.concat([buf, Buffer.alloc(pad, pad)]);
};

const pkcs5UnPad = (buf: Buffer): Buffer => {
  const pad = buf[buf.length - 1];

  if (pad <= 0 || pad > buf.length) throw new Error('Invalid PKCS#5 padding');

  return Buffer.from(buf.subarray(0, buf.length - pad));
};

export function encrypt3DES(text: string | Buffer, key: Buffer, padding = true): Buffer {
  const cipher = crypto.createCipheriv('des-ede3-cbc', key, IV);

  cipher.setAutoPadding(false);

  const inputBuffer = typeof text === 'string' ? Buffer.from(text, 'utf8') : text;

  const input = padding ? pkcs5Pad(inputBuffer, 8) : inputBuffer;

  return Buffer.concat([cipher.update(input), cipher.final()]);
}

export function decrypt3DES(encrypted: Buffer, key: Buffer): string {
  const decipher = crypto.createDecipheriv('des-ede3-cbc', key, IV);

  decipher.setAutoPadding(false);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return pkcs5UnPad(decrypted).toString('utf8');
}

export function getDivKey(key: string): Buffer {
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  const leftKey = hash.slice(0, 32);
  const rightKey = hash.slice(-32);

  const xorKey = xorBuffers(Buffer.from(leftKey, 'hex'), Buffer.from(rightKey, 'hex'));

  const divKey = Buffer.concat([xorKey, Buffer.from(xorKey.subarray(0, 8))]);

  return divKey;
}

export function getTXN(input: string, key: string): string {
  const divKey = getDivKey(key);

  const encrypted = encrypt3DES(input, divKey, true);

  return encrypted.toString('hex').toUpperCase();
}

export function getMAC(input: string, key: string): string {
  const divKey = getDivKey(key);

  const encrypted = encrypt3DES(input, divKey, true);
  const sha = crypto.createHash('sha256').update(encrypted).digest();
  const finalEnc = encrypt3DES(sha, divKey, false);

  return finalEnc.toString('hex').toUpperCase().slice(-8); // Last 8 characters (4 bytes)
}

export function getDecTXN(input: string, key: string): string {
  const divKey = getDivKey(key);

  const decrypted = decrypt3DES(Buffer.from(input, 'hex'), divKey);

  return decrypted;
}

/**
 * 3DES-ECB encryption used by AMEX SOAP MAC calculations.
 * - Accepts 8-byte or 24-byte key (8 repeats 3x to 24).
 * - Pads with PKCS#5 only when input length is NOT multiple of 8.
 * - Returns uppercase hex string of raw ciphertext.
 */
export function desEcbEncryptHex(data: string | Buffer, key: string): string {
  const normalizeKey = (k: string): Buffer => {
    if (k.length === 24) return Buffer.from(k, 'utf8');

    if (k.length === 8) return Buffer.from(k.repeat(3), 'utf8');
    throw new Error('Invalid 3DES key length (must be 8 or 24 chars)');
  };

  const inputBuf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const rem = inputBuf.length % 8;
  const padded = rem === 0 ? inputBuf : Buffer.concat([inputBuf, Buffer.alloc(8 - rem, 8 - rem)]);

  const cipher = crypto.createCipheriv('des-ede3-ecb', normalizeKey(key), null);

  cipher.setAutoPadding(false);
  const enc = Buffer.concat([cipher.update(padded), cipher.final()]);

  return enc.toString('hex').toUpperCase();
}
