import { Buffer } from 'node:buffer';
import { encrypt3DES, getDivKey, getMAC } from './ctbc-crypto-core';
import {
  CTBCBindCardRequestPayload,
  CTBCOrderCommitPayload,
  CTBCTxnPayload,
} from './typings';

export const toTxnPayload = <T extends object>(value: T): CTBCTxnPayload =>
  value as unknown as CTBCTxnPayload;

export function buildReqjsonpwd(
  serviceName: string,
  payload: CTBCBindCardRequestPayload & CTBCTxnPayload,
  gateway: { merchantId: string; txnKey: string }
): string;

export function buildReqjsonpwd(
  serviceName: string,
  payload: CTBCOrderCommitPayload & CTBCTxnPayload,
  gateway: { merchantId: string; txnKey: string }
): string;

export function buildReqjsonpwd(
  serviceName: string,
  payload: CTBCTxnPayload,
  gateway: { merchantId: string; txnKey: string }
): string;

export function buildReqjsonpwd(
  serviceName: string,
  payload: CTBCTxnPayload,
  gateway: { merchantId: string; txnKey: string }
): string {
  const urlString = Object.entries(payload)
    .filter(([_, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const divKey = getDivKey(gateway.txnKey);
  const mac = getMAC(urlString, gateway.txnKey);
  const txn = encrypt3DES(urlString, divKey, true);

  const request = {
    Request: {
      Header: {
        ServiceName: serviceName,
        Version: '1.0',
        MerchantID: gateway.merchantId,
        RequestTime: new Date().toISOString().slice(0, 19).replace(/-/g, '/').replace('T', ' '),
      },
      Data: {
        MAC: mac,
        TXN: txn.toString('hex').toUpperCase(),
      },
    },
  };

  const json = JSON.stringify(request);
  const base64 = Buffer.from(json).toString('base64');

  return Buffer.from(base64).toString('hex').toUpperCase();
}
