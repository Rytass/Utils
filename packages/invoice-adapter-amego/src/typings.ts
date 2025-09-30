import {
  InvoiceAllowanceOptions,
  InvoiceAllowanceState,
  InvoiceIssueOptions,
  InvoicePaymentItem,
  InvoiceState,
  InvoiceVoidOptions,
  TaxType,
} from '@rytass/invoice';
import { AmegoInvoice } from './amego-invoice';
import { AmegoAllowance } from './amego-allowance';

export enum AmegoBaseUrls {
  DEVELOPMENT = 'https://invoice-api.amego.tw',
  PRODUCTION = 'https://invoice-api.amego.tw',
}

export interface AmegoInvoiceGatewayOptions {
  appKey: string;
  vatNumber: string;
  baseUrl?: AmegoBaseUrls;
}

export interface AmegoPaymentItem extends InvoicePaymentItem {
  name: string; // 品名
  quantity: number; // 數量
  unit?: string; // 單位
  unitPrice: number; // 單價, 預設含稅0
  // amount: number; // 金額, 預設含稅0
  remark?: string;
  taxType: TaxType.TAXED | TaxType.TAX_FREE | TaxType.ZERO_TAX;
}

export interface AmegoInvoiceVoidOptions extends InvoiceVoidOptions {
  reason: string;
}

export interface AmegoInvoiceOptions {
  orderId: string; // 訂單編號
  vatNumber?: string; // 買方統一編號
  buyerInfo?: {
    name: string;
    email: string;
  };

  items: AmegoPaymentItem[];
  issuedOn?: Date | null;
  invoiceNumber: string;
  randomCode: string;

  taxType: TaxType;
  voidOn: Date | null;
  state?: InvoiceState;
  allowances?: AmegoAllowance[];
  taxRate?: number; // 稅率, 預設含稅 0.05 (5%)
  carrier?: {
    type: string;
    code: string;
  };
}

export interface AmegoInvoiceIssueOptions extends InvoiceIssueOptions<AmegoPaymentItem> {
  orderId: string;
  items: AmegoPaymentItem[];
  salesAmount?: number; // 銷售金額, 預設含稅0
  freeTaxSalesAmount?: number; // 免稅銷售金額, 預設含稅0
  zeroTaxSalesAmount?: number; // 零稅率銷售金額, 預設含稅0
  taxType: TaxType; // 課稅別
  taxRate?: number; // 稅率, 預設含稅 0.05 (5%)
  taxAmount?: number; // 稅額, 預設含稅 0
  totalAmount?: number; // 總金額, 預設含稅 0
  remark?: string; // 備註
  detailVat: boolean; // 明細是否含稅, 預設為true (含稅) , 亦可為false (未稅)
  buyerEmail?: string; // 買方電子信箱
  buyerName?: string; // 買方名稱(抬頭)
}

export const AmegoTaxType = {
  [TaxType.TAXED]: '1',
  [TaxType.ZERO_TAX]: '2',
  [TaxType.TAX_FREE]: '3',
  [TaxType.SPECIAL]: '4',
  [TaxType.MIXED]: '9',
} as Record<TaxType, '1' | '2' | '3' | '4' | '9'>;

export const ReverseAmegoTaxType = {
  1: TaxType.TAXED,
  2: TaxType.ZERO_TAX,
  3: TaxType.TAX_FREE,
} as Record<number, TaxType>;

export interface AmegoIssueInvoicePayload {}

export interface AmegoIssueInvoiceResponse {
  code: number;
  msg: string;
  invoice_number: string;
  invoice_time: number;
  random_number: string;
  barcode: string;
  qrcode_left: string;
  qrcode_right: string;
  base64_data: string;
}

export interface AmegoVoidAllowanceResponse {}

export interface AmegoAllowanceOptions extends InvoiceAllowanceOptions {
  allowanceNumber: string;
  allowancePrice: number;
  allowancedOn: Date;
  items: AmegoPaymentItem[];
  parentInvoice: AmegoInvoice;
  status: InvoiceAllowanceState;
  invalidOn: Date | null;
  invoiceType?: string;
  allowanceType?: AmegoAllowanceType;
  issuedAmount?: number; // 發票金額
}

export enum AmegoAllowanceType {
  BUYER_ISSUED = 1,
  SELLER_ISSUED = 2,
}

export interface AmegoInvoiceQueryFromOrderIdArgs {
  orderId: string;
}

export interface AmegoInvoiceQueryFromInvoiceNumberArgs {
  invoiceNumber: string;
}

export type AmegoInvoiceQueryArgs = AmegoInvoiceQueryFromOrderIdArgs | AmegoInvoiceQueryFromInvoiceNumberArgs;

// 常數定義
export const AMEGO_CONSTANTS = {
  MAX_ORDER_ID_LENGTH: 40,
  MAX_ITEM_NAME_LENGTH: 256,
  MAX_ITEM_UNIT_LENGTH: 6,
  MAX_ITEM_REMARK_LENGTH: 40,
  DEFAULT_TAX_RATE: 0.05,
  LOVE_CODE_MIN_LENGTH: 3,
  LOVE_CODE_MAX_LENGTH: 7,
} as const;
