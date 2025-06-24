import { decrypt3DES, getDivKey, getMAC } from './ctbc-crypto-core';
import { Buffer } from 'node:buffer';
import { CTBCRawResponse } from './typings';

export function parseRspjsonpwd(
  hex: string,
  txnKey: string
): Record<string, string> {
  const base64 = Buffer.from(hex, 'hex').toString('utf8');
  const json = Buffer.from(base64, 'base64').toString('utf8');

  let parsed: CTBCRawResponse;

  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error('Invalid rspjsonpwd: JSON parse failed');
  }

  const encTxn = parsed.Response?.Data?.TXN;

  if (!encTxn) {
    throw new Error('Missing TXN in rspjsonpwd');
  }

  const divKey = getDivKey(txnKey);
  const decrypted = decrypt3DES(Buffer.from(encTxn, 'hex'), divKey);

  const kv = decrypted.split('&').filter(Boolean);
  const result: Record<string, string> = {};

  for (const pair of kv) {
    const [k, v] = pair.split('=');

    if (k) result[k] = v ?? '';
  }

  return result;
}

export function validateRspjsonpwdMAC(
  rspjsonpwd: string,
  txnKey: string
): boolean {
  try {
    const base64 = Buffer.from(rspjsonpwd, 'hex').toString('utf8');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    const parsed: CTBCRawResponse = JSON.parse(json);

    const mac = parsed.Response?.Data?.MAC;
    const encTxn = parsed.Response?.Data?.TXN;

    if (!mac || !encTxn) return false;

    const divKey = getDivKey(txnKey);
    const decrypted = decrypt3DES(Buffer.from(encTxn, 'hex'), divKey);
    const recomputed = getMAC(decrypted, txnKey);

    return mac.toUpperCase() === recomputed;
  } catch {
    return false;
  }
}
