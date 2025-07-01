import { Buffer } from 'node:buffer';
import { decrypt3DES, getDivKey, getMAC } from './ctbc-crypto-core';
import { CTBCRawResponse } from './typings';

export function toStringRecord<T>(input: T): Record<string, string> {
  return input as Record<string, string>;
}

export function decodeResponsePayload<T = Record<string, string>>(
  encoded: string,
  txnKey: string,
  options?: { validateMAC?: boolean },
): T {
  const params = new URLSearchParams(encoded);

  const requestJsonPwd = params.get('reqjsonpwd') ?? encoded;

  if (!requestJsonPwd) {
    throw new Error('Missing reqjsonpwd');
  }

  const hexEncoded = decodeURIComponent(requestJsonPwd);
  const json = Buffer.from(hexEncoded, 'hex').toString('utf8');

  const response: CTBCRawResponse = JSON.parse(json);
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
    const sorted = Object.entries(obj)
      .filter(([_, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const expected = getMAC(sorted, txnKey);

    if (expected !== MAC) {
      throw new Error('MAC validation failed');
    }
  }

  return obj as T;
}

export function validateResponseMAC<T extends Record<string, string>>(
  payload: T,
  txnKey: string,
): boolean {
  const sorted = Object.entries(payload)
    .filter(([_, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const expected = getMAC(sorted, txnKey);

  return expected === payload.MAC;
}
