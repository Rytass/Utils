import { AxiosError, AxiosResponse } from 'axios';
import {
  TurnkeyAllowanceProofResponse,
  TurnkeyAllowanceResponse,
  TurnkeyInvoiceProofResponse,
  TurnkeyInvoiceResponse,
} from '../src';

export const BASE_URL = 'https://turnkey.test/api/';
export const COMPANY_TAX_ID = '12345675';
export const COMPANY_URL = `https://turnkey.test/api/companies/${COMPANY_TAX_ID}`;

export const okResponse = <T>(data: T, status = 202): AxiosResponse<T> =>
  ({ data, status, statusText: 'OK', headers: {}, config: {} }) as AxiosResponse<T>;

export const httpError = (status: number, data: unknown): AxiosError =>
  new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', undefined, undefined, {
    data,
    status,
    statusText: 'ERR',
    headers: {},
    config: {},
  } as AxiosResponse);

/** 依 URL 分派 GET 回應：.../allowances 回空清單，其餘回發票。 */
export const invoiceAwareGet = (url: string): Promise<AxiosResponse> =>
  Promise.resolve(url.endsWith('/allowances') ? okResponse([]) : okResponse(invoiceResponse()));

export const invoiceResponse = (overrides: Partial<TurnkeyInvoiceResponse> = {}): TurnkeyInvoiceResponse => ({
  id: 'inv_1',
  companyTaxId: COMPANY_TAX_ID,
  invoiceNumber: 'AB12345678',
  externalId: 'ORDER-1',
  deliveryMode: 'STORAGE',
  status: 'ISSUED',
  issuedAt: '2026-10-21T10:00:00+08:00',
  buyerTaxId: '0000000000',
  buyerName: null,
  taxType: 'TAXABLE',
  taxRate: 0.05,
  salesAmount: 100,
  taxFreeSalesAmount: 0,
  zeroRatedSalesAmount: 0,
  taxAmount: 5,
  totalAmount: 105,
  carrierType: null,
  carrierCode: null,
  npoCode: null,
  printed: false,
  randomNumber: '1234',
  voidedAt: null,
  items: [{ sequenceNumber: 1, description: '商品', quantity: 1, unitPrice: 105, amount: 105, taxType: 'TAXABLE' }],
  ...overrides,
});

export const allowanceResponse = (overrides: Partial<TurnkeyAllowanceResponse> = {}): TurnkeyAllowanceResponse => ({
  id: 'alw_1',
  allowanceNumber: 'AL0000001',
  invoiceNumber: 'AB12345678',
  status: 'ISSUED',
  allowanceDate: '2026-10-22T09:00:00+08:00',
  taxAmount: 5,
  totalAmount: 100,
  voidedAt: null,
  items: [{ sequenceNumber: 1, description: '商品', quantity: 1, unitPrice: 100, amount: 100, taxType: 'TAXABLE' }],
  ...overrides,
});

export const invoiceProofResponse = (
  overrides: Partial<TurnkeyInvoiceProofResponse> = {},
): TurnkeyInvoiceProofResponse => ({
  documentType: 'INVOICE',
  invoiceNumber: 'AB12345678',
  issuedAt: '2026-10-21T10:00:00+08:00',
  periodLabel: '115年09-10月',
  randomNumber: '1234',
  seller: { taxId: COMPANY_TAX_ID, name: '測試公司', address: null },
  buyer: { taxId: null, name: '消費者', address: null },
  deliveryMode: 'STORAGE',
  taxType: 'TAXABLE',
  salesAmount: 100,
  taxFreeSalesAmount: 0,
  zeroRatedSalesAmount: 0,
  taxAmount: 5,
  totalAmount: 105,
  zeroRated: null,
  mainRemark: null,
  items: [
    {
      sequenceNumber: 1,
      description: '商品',
      quantity: 1,
      unit: null,
      unitPrice: 105,
      amount: 105,
      taxType: 'TAXABLE',
      remark: null,
    },
  ],
  barcode: '1150910AB1234512345',
  qrCodeLeft: 'AB12345678',
  qrCodeRight: ':',
  printCount: 1,
  reprint: false,
  printedAt: '2026-10-21T10:05:00+08:00',
  ...overrides,
});

export const allowanceProofResponse = (
  overrides: Partial<TurnkeyAllowanceProofResponse> = {},
): TurnkeyAllowanceProofResponse => ({
  documentType: 'ALLOWANCE',
  allowanceNumber: 'AL0000001',
  allowanceDate: '2026-10-22T09:00:00+08:00',
  originalInvoiceNumber: 'AB12345678',
  originalInvoiceIssuedAt: '2026-10-21T10:00:00+08:00',
  seller: { taxId: COMPANY_TAX_ID, name: '測試公司', address: null },
  buyer: { taxId: null, name: '消費者', address: null },
  deliveryMode: 'STORAGE',
  totalAmount: 100,
  taxAmount: 5,
  items: [
    {
      sequenceNumber: 1,
      description: '商品',
      quantity: 1,
      unitPrice: 100,
      amount: 100,
      taxType: 'TAXABLE',
      originalSequenceNumber: null,
      tax: 5,
    },
  ],
  printCount: 1,
  reprint: false,
  printedAt: '2026-10-22T09:05:00+08:00',
  ...overrides,
});
