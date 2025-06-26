import { decrypt3DES, getDivKey, getMAC } from './ctbc-crypto-core';
import { Buffer } from 'node:buffer';
import { CTBCRawResponse } from './typings';

export function toStringRecord<T>(input: T): Record<string, string> {
  return input as unknown as Record<string, string>;
}

export function parseRspjsonpwd<T = Record<string, string>>(hex: string, txnKey: string): T {
  const base64 = Buffer.from(hex, 'hex').toString('utf8');
  const json = Buffer.from(base64, 'base64').toString('utf8');

  const response: CTBCRawResponse = JSON.parse(json);
  const { MAC, TXN } = response.Response.Data;

  const divKey = getDivKey(txnKey);
  const decrypted = decrypt3DES(Buffer.from(TXN, 'hex'), divKey);

  const obj = Object.fromEntries(
    decrypted.split('&').map(kv => {
      const [k, v] = kv.split('=');

      return [k, v];
    })
  );

  return obj as T;
}

export function validateRspjsonpwdMAC<T extends Record<string, string>>(
  payload: T,
  txnKey: string
): boolean {
  const sorted = Object.entries(payload)
    .filter(([_, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const expected = getMAC(sorted, txnKey);

  return expected === payload.MAC;
}

