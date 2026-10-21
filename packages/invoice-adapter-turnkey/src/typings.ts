import { InvoiceCarrier, InvoiceIssueOptions, InvoicePaymentItem, TaxType } from '@rytass/invoice';

export type TurnkeyDeliveryMode = 'STORAGE' | 'EXCHANGE';

export type TurnkeyItemTaxType = 'TAXABLE' | 'ZERO_RATED' | 'TAX_FREE' | 'SPECIAL';

export type TurnkeyTaxType = TurnkeyItemTaxType | 'MIXED';

export type TurnkeyZeroRatedReasonCode = '71' | '72' | '73' | '74' | '75' | '76' | '77' | '78' | '79';

export type TurnkeyCarrierType = 'MOBILE' | 'MOICA' | 'MEMBER' | 'PLATFORM';

export type TurnkeyInvoiceStatus =
  | 'SUBMITTED'
  | 'ISSUED'
  | 'FAILED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'REJECTION_ACKNOWLEDGED'
  | 'VOID_PENDING'
  | 'VOIDED'
  | 'ANNULLED';

export type TurnkeyAllowanceStatus = 'SUBMITTED' | 'ISSUED' | 'FAILED' | 'CONFIRMED' | 'VOID_PENDING' | 'VOIDED';

export interface TurnkeyPaymentItem extends InvoicePaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;
  unit?: string;
  remark?: string;
  taxType?: TaxType.TAXED | TaxType.TAX_FREE | TaxType.ZERO_TAX | TaxType.SPECIAL;
}

export interface TurnkeyAllowanceItem extends TurnkeyPaymentItem {
  originalSequenceNumber?: number;
}

export interface TurnkeyBuyer {
  name?: string;
  address?: string;
}

export interface TurnkeyInvoiceIssueOptions extends InvoiceIssueOptions<TurnkeyPaymentItem> {
  /** 呼叫端訂單編號，同時作為 externalId 與 Idempotency-Key（issue）。 */
  orderId: string;
  /** MEMBER、PLATFORM 載具必須帶 typeCode（6 碼 [0-9A-Z]，平台配發的載具類別號碼）。 */
  carrier?: InvoiceCarrier & { typeCode?: string };
  buyer?: TurnkeyBuyer;
  issuedAt?: Date;
  /** 對應 REST 的 mainRemark。 */
  remark?: string;
  /** 含 ZERO_TAX 項目時必填（71..79）。 */
  zeroRatedReasonCode?: TurnkeyZeroRatedReasonCode;
  /** 含 SPECIAL 項目時必填。 */
  specialTaxRate?: number;
}

export interface TurnkeyAllowanceOptions {
  /** 原發票為 MIXED 時必填；其餘情況未指定則沿用原發票稅別。 */
  taxType?: TaxType.TAXED | TaxType.TAX_FREE | TaxType.ZERO_TAX;
  /** 覆寫預設的 Idempotency-Key；要刻意開立內容相同的兩張折讓時使用。 */
  idempotencyKey?: string;
}

export type TurnkeyInvoiceQueryOptions = { orderId: string } | { invoiceNumber: string };

export interface TurnkeyInvoiceGatewayOptions {
  baseUrl: string;
  companyTaxId: string;
  deliveryMode?: TurnkeyDeliveryMode;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface TurnkeyIssue {
  code: string;
  message: string;
  field: string;
}

export interface TurnkeyIssueRequestItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxType: TurnkeyItemTaxType;
  unit?: string;
  remark?: string;
}

export interface TurnkeyIssueRequestBody {
  deliveryMode: TurnkeyDeliveryMode;
  externalId: string;
  buyer?: { taxId?: string; name?: string; address?: string };
  items: TurnkeyIssueRequestItem[];
  issuedAt?: string;
  carrier?: { type: TurnkeyCarrierType; code: string; typeCode?: string };
  donation?: { npoCode: string };
  printed?: boolean;
  zeroRated?: { reasonCode: TurnkeyZeroRatedReasonCode; customsClearance: 'NOT_VIA_CUSTOMS' | 'VIA_CUSTOMS' };
  specialTaxRate?: number;
  mainRemark?: string;
}

export interface TurnkeyVoidRequestBody {
  reason: string;
  remark?: string;
}

export interface TurnkeyAllowanceRequestItem {
  originalSequenceNumber?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxType: TurnkeyItemTaxType;
}

export interface TurnkeyAllowanceRequestBody {
  invoiceNumber: string;
  externalId?: string;
  allowanceDate?: string;
  items: TurnkeyAllowanceRequestItem[];
}

export interface TurnkeyAllowanceVoidRequestBody {
  reason: string;
}

export interface TurnkeyInvoiceItemResponse {
  sequenceNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxType: TurnkeyItemTaxType;
}

export interface TurnkeyInvoiceResponse {
  id: string;
  companyTaxId: string;
  invoiceNumber: string | null;
  externalId: string | null;
  deliveryMode: TurnkeyDeliveryMode;
  status: TurnkeyInvoiceStatus;
  /** Core 的 issuedAt 欄位不可為 null */
  issuedAt: string;
  buyerTaxId: string | null;
  buyerName: string | null;
  taxType: TurnkeyTaxType;
  taxRate: number | null;
  salesAmount: number;
  taxFreeSalesAmount: number;
  zeroRatedSalesAmount: number;
  taxAmount: number;
  totalAmount: number;
  carrierType: TurnkeyCarrierType | null;
  carrierCode: string | null;
  npoCode: string | null;
  printed: boolean;
  randomNumber: string | null;
  voidedAt: string | null;
  items: TurnkeyInvoiceItemResponse[];
}

export interface TurnkeyAllowanceResponse {
  id: string;
  allowanceNumber: string | null;
  invoiceNumber: string;
  status: TurnkeyAllowanceStatus;
  allowanceDate: string;
  /** 未稅金額合計；折讓金額（含稅）為 totalAmount + taxAmount。 */
  taxAmount: number;
  totalAmount: number;
  voidedAt: string | null;
  items: TurnkeyInvoiceItemResponse[];
}

export type TurnkeyProofFormat = 'JSON' | 'PDF' | 'PNG' | 'ESC_POS' | 'A4_PDF';

/** 非 JSON 格式回傳二進位檔案。 */
export type TurnkeyBinaryProofFormat = Exclude<TurnkeyProofFormat, 'JSON'>;

export interface TurnkeyProofRequestOptions {
  /** 同一個 key 重送回傳同一次列印（不會變成補印）；省略時每次呼叫視為新的列印 */
  readonly idempotencyKey?: string;
  /** 寫進列印紀錄的操作者 */
  readonly operator?: string;
}

export interface TurnkeyProofParty {
  /** 消費者為 null */
  taxId: string | null;
  name: string;
  address: string | null;
}

export interface TurnkeyProofLine {
  sequenceNumber: number;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  amount: number;
  taxType: TurnkeyItemTaxType;
  remark: string | null;
}

/**
 * GET /invoices/{invoiceNumber}/proof?format=JSON 的回應（原始 JSON，日期為 ISO 字串，與 TurnkeyInvoiceResponse 一致）。
 * 條碼與 QR Code 內容供列印端使用；B2B 沒有隨機碼時 randomNumber 為 null。
 */
export interface TurnkeyInvoiceProofResponse {
  documentType: 'INVOICE';
  invoiceNumber: string;
  issuedAt: string;
  /** 例如 "115年09-10月" */
  periodLabel: string;
  randomNumber: string | null;
  seller: TurnkeyProofParty;
  buyer: TurnkeyProofParty;
  deliveryMode: TurnkeyDeliveryMode;
  taxType: TurnkeyTaxType;
  salesAmount: number;
  taxFreeSalesAmount: number;
  zeroRatedSalesAmount: number;
  taxAmount: number;
  totalAmount: number;
  zeroRated: { reasonCode: string; customsClearance: 'NOT_VIA_CUSTOMS' | 'VIA_CUSTOMS' } | null;
  mainRemark: string | null;
  items: TurnkeyProofLine[];
  /** Code 39 內容，19 碼 */
  barcode: string;
  qrCodeLeft: string;
  qrCodeRight: string;
  /** 這是第幾次列印（每次呼叫都會計入） */
  printCount: number;
  /** 第 2 次起為 true，證明聯加註「補印」 */
  reprint: boolean;
  printedAt: string;
}

/** GET /allowances/{allowanceNumber}/proof?format=JSON 的回應（原始 JSON，日期為 ISO 字串）。折讓證明單沒有條碼。 */
export interface TurnkeyAllowanceProofResponse {
  documentType: 'ALLOWANCE';
  allowanceNumber: string;
  allowanceDate: string;
  originalInvoiceNumber: string;
  originalInvoiceIssuedAt: string;
  seller: TurnkeyProofParty;
  buyer: TurnkeyProofParty;
  deliveryMode: TurnkeyDeliveryMode;
  /** 未稅 */
  totalAmount: number;
  taxAmount: number;
  items: (Omit<TurnkeyProofLine, 'unit' | 'remark'> & {
    originalSequenceNumber: number | null;
    tax: number;
  })[];
  printCount: number;
  reprint: boolean;
  printedAt: string;
}

export interface TurnkeyMobileBarcodeValidationResponse {
  valid: boolean;
}

export interface TurnkeyNpoCodeValidationResponse {
  valid: boolean;
}
