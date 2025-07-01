import { Buffer } from 'node:buffer';
import { decrypt3DES, getDivKey, getMAC } from './ctbc-crypto-core';

export function toStringRecord<T>(input: T): Record<string, string> {
  return input as Record<string, string>;
}

export function decodeResponsePayload<T = Record<string, string>>(
  encoded: string,
  txnKey: string,
  options?: { validateMAC?: boolean },
): T {
  const params = new URLSearchParams(encoded);
  const rawResponseKey = Array.from(params.keys())[0];

  if (!rawResponseKey) {
    throw new Error('Missing encoded response payload');
  }

  const json = decodeURIComponent(decodeURIComponent(rawResponseKey));
  const response = JSON.parse(json);

  const { MAC, TXN } = response.Response.Data;

  const divKey = getDivKey(txnKey);
  const decrypted = decrypt3DES(Buffer.from(TXN, 'hex'), divKey);

  const obj = Object.fromEntries(
    decrypted.split('&').map((kv) => {
      const [k, v] = kv.split('=');

      return [k, v ?? ''];
    }),
  ) as Record<string, string>;

  if (options?.validateMAC ?? true) {
    if (!validateResponseMAC(decrypted, MAC, txnKey)) {
      throw new Error('MAC validation failed');
    }
  }

  return obj as T;
}

export function validateResponseMAC(
  txnPlaintext: string,
  mac: string,
  txnKey: string,
): boolean {
  const expected = getMAC(txnPlaintext, txnKey);

  return expected === mac;
}
