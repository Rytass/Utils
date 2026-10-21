import type {
  TurnkeyCustomsClearance,
  TurnkeyDeliveryMode,
  TurnkeyProofFormat,
  TurnkeyTaxType,
} from '../typings/turnkey-enums';
import type { TurnkeyItemTaxType } from '../typings/turnkey-invoice.types';

export interface TurnkeyProofParty {
  /** 消費者為 null */
  readonly taxId: string | null;
  readonly name: string;
  readonly address: string | null;
}

export interface TurnkeyProofLine {
  readonly sequenceNumber: number;
  readonly description: string;
  readonly quantity: number;
  readonly unit: string | null;
  readonly unitPrice: number;
  readonly amount: number;
  readonly taxType: TurnkeyItemTaxType;
  readonly remark: string | null;
}

/** 證明聯上的全部內容；格式（熱感紙、A4、ESC/POS）由 render() 或使用端決定 */
export interface TurnkeyInvoiceProof {
  readonly documentType: 'INVOICE';
  readonly invoiceNumber: string;
  readonly issuedAt: Date;
  /** 115年09-10月 */
  readonly periodLabel: string;
  /** B2B 沒有隨機碼時為 null（條碼與 QR Code 以 4 個空白代替） */
  readonly randomNumber: string | null;
  readonly seller: TurnkeyProofParty;
  readonly buyer: TurnkeyProofParty;
  readonly deliveryMode: TurnkeyDeliveryMode;
  readonly taxType: TurnkeyTaxType;
  readonly salesAmount: number;
  readonly taxFreeSalesAmount: number;
  readonly zeroRatedSalesAmount: number;
  readonly taxAmount: number;
  readonly totalAmount: number;
  readonly zeroRated: { readonly reasonCode: string; readonly customsClearance: TurnkeyCustomsClearance } | null;
  readonly mainRemark: string | null;
  readonly items: readonly TurnkeyProofLine[];
  /** Code 39 內容，19 碼 */
  readonly barcode: string;
  readonly qrCodeLeft: string;
  readonly qrCodeRight: string;
  /** 這是第幾次列印 */
  readonly printCount: number;
  /** 第 2 次起為 true，證明聯加註「補印」 */
  readonly reprint: boolean;
  readonly printedAt: Date;
}

/** 折讓證明單：沒有條碼，留買受人簽收欄 */
export interface TurnkeyAllowanceProof {
  readonly documentType: 'ALLOWANCE';
  readonly allowanceNumber: string;
  readonly allowanceDate: Date;
  readonly originalInvoiceNumber: string;
  readonly originalInvoiceIssuedAt: Date;
  readonly seller: TurnkeyProofParty;
  readonly buyer: TurnkeyProofParty;
  readonly deliveryMode: TurnkeyDeliveryMode;
  /** 未稅 */
  readonly totalAmount: number;
  readonly taxAmount: number;
  readonly items: readonly (Omit<TurnkeyProofLine, 'unit' | 'remark'> & {
    readonly originalSequenceNumber: number | null;
    readonly tax: number;
  })[];
  readonly printCount: number;
  readonly reprint: boolean;
  readonly printedAt: Date;
}

export type TurnkeyProof = TurnkeyInvoiceProof | TurnkeyAllowanceProof;

export interface TurnkeyProofRequest {
  readonly companyTaxId: string;
  /** 寫進 turnkey_print_logs 的格式，預設 JSON */
  readonly format?: TurnkeyProofFormat;
  /** 操作者（寫進 turnkey_print_logs） */
  readonly operator?: string;
  /** 同一個 key 重送（網路重試、快取重放）回傳同一次列印，不會變成補印 */
  readonly idempotencyKey?: string;
}

export interface TurnkeyRenderOptions {
  readonly format: TurnkeyProofFormat;
  /** 熱感紙寬度，預設 57 */
  readonly paperWidthMm?: number;
  /** PDF／PNG 用的中文字型檔（TTF／OTF）路徑；pdfkit 內建字型沒有中文 */
  readonly fontPath?: string;
}

export interface TurnkeyRenderedProof {
  readonly format: TurnkeyProofFormat;
  readonly contentType: string;
  readonly body: Buffer;
}
