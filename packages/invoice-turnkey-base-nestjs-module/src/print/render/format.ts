import { DateTime } from 'luxon';

const ZONE = 'Asia/Taipei';

/** 開立日期時間，例如 2026-10-21 10:30:00（台北時間） */
export const formatDateTime = (date: Date): string =>
  DateTime.fromJSDate(date, { zone: ZONE }).toFormat('yyyy-MM-dd HH:mm:ss');

export const formatDate = (date: Date): string => DateTime.fromJSDate(date, { zone: ZONE }).toFormat('yyyy-MM-dd');

/** 發票號碼顯示為 AB-12345678 */
export const formatInvoiceNumber = (invoiceNumber: string): string =>
  invoiceNumber.length === 10 ? `${invoiceNumber.slice(0, 2)}-${invoiceNumber.slice(2)}` : invoiceNumber;

/** 金額千分位，例如 1,335 */
export const formatAmount = (value: number): string => value.toLocaleString('en-US');
