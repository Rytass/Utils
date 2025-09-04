import { Buffer } from 'node:buffer';
import { encrypt3DES, getDivKey, getMAC } from './ctbc-crypto-core';
import { CTBCBindCardRequestPayload, CTBCOrderCommitPayload, CTBCTxnPayload } from './typings';

export const toTxnPayload = <T extends object>(value: T): CTBCTxnPayload => value as CTBCTxnPayload;

export function encodeRequestPayload(
  serviceName: string,
  payload: CTBCBindCardRequestPayload & CTBCTxnPayload,
  gateway: { merchantId: string; txnKey: string },
): string;

// eslint-disable-next-line no-redeclare
export function encodeRequestPayload(
  serviceName: string,
  payload: CTBCOrderCommitPayload & CTBCTxnPayload,
  gateway: { merchantId: string; txnKey: string },
): string;

// eslint-disable-next-line no-redeclare
export function encodeRequestPayload(
  serviceName: string,
  payload: CTBCTxnPayload,
  gateway: { merchantId: string; txnKey: string },
): string;

// eslint-disable-next-line no-redeclare
export function encodeRequestPayload(
  serviceName: string,
  payload: CTBCTxnPayload,
  gateway: { merchantId: string; txnKey: string },
): string {
  const urlString = Object.entries(payload)
    .filter(([_, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
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
  const encoded = encodeURIComponent(json);

  return encoded;
}
