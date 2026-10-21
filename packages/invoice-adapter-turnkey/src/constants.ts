import { CustomsMark, InvoiceAllowanceState, InvoiceState } from '@rytass/invoice';
import { TurnkeyAllowanceStatus, TurnkeyInvoiceStatus } from './typings';

export const TURNKEY_IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

export const TURNKEY_DEFAULT_TIMEOUT_MS = 30_000;

export const TURNKEY_DEFAULT_ALLOWANCE_REASON = '作廢折讓';

export const TurnkeyCustomsClearance = {
  [CustomsMark.NO]: 'NOT_VIA_CUSTOMS',
  [CustomsMark.YES]: 'VIA_CUSTOMS',
} as const;

/**
 * 發票狀態對應到 @rytass/invoice 的 InvoiceState（依「Turnkey NestJS 模組規劃」）。
 * SUBMITTED、ISSUED、CONFIRMED、REJECTED 為 ISSUED（有折讓時由 TurnkeyInvoice 改為 ALLOWANCED）；
 * VOID_PENDING、VOIDED、ANNULLED、REJECTION_ACKNOWLEDGED 為 VOID；
 * FAILED 為 INITED（query() 照常回傳，由呼叫端決定修正重送或放棄）。原始狀態保留在 `turnkeyStatus`。
 */
export const TURNKEY_INVOICE_STATE: Record<TurnkeyInvoiceStatus, InvoiceState> = {
  SUBMITTED: InvoiceState.ISSUED,
  ISSUED: InvoiceState.ISSUED,
  CONFIRMED: InvoiceState.ISSUED,
  REJECTED: InvoiceState.ISSUED,
  VOID_PENDING: InvoiceState.VOID,
  VOIDED: InvoiceState.VOID,
  ANNULLED: InvoiceState.VOID,
  REJECTION_ACKNOWLEDGED: InvoiceState.VOID,
  FAILED: InvoiceState.INITED,
};

export const TURNKEY_ALLOWANCE_STATE: Record<TurnkeyAllowanceStatus, InvoiceAllowanceState> = {
  SUBMITTED: InvoiceAllowanceState.ISSUED,
  ISSUED: InvoiceAllowanceState.ISSUED,
  CONFIRMED: InvoiceAllowanceState.ISSUED,
  VOID_PENDING: InvoiceAllowanceState.ISSUED,
  VOIDED: InvoiceAllowanceState.INVALID,
  FAILED: InvoiceAllowanceState.INITED,
};
