import {
  TurnkeyCarrierType,
  TurnkeyCustomsClearance,
  TurnkeyDeliveryMode,
  TurnkeyMigMessageType,
  TurnkeyTaxType,
} from './turnkey-enums';

export type TurnkeyItemTaxType = Exclude<TurnkeyTaxType, TurnkeyTaxType.MIXED>;

export interface TurnkeyParty {
  readonly taxId: string;
  readonly name: string;
  readonly address?: string;
}

export interface TurnkeyBuyerInput {
  /** 消費者不填 */
  readonly taxId?: string;
  readonly name?: string;
  readonly address?: string;
}

export interface TurnkeyInvoiceItemInput {
  readonly description: string;
  readonly quantity: number;
  /** B2B 為未稅單價；B2C 為含稅單價 */
  readonly unitPrice: number;
  readonly taxType: TurnkeyItemTaxType;
  /** 省略時為 quantity × unitPrice */
  readonly amount?: number;
  readonly unit?: string;
  readonly remark?: string;
}

export interface TurnkeyCarrierInput {
  readonly type: TurnkeyCarrierType;
  readonly code: string;
  /** 隱碼；省略時與 code 相同 */
  readonly hiddenCode?: string;
  /** 載具類別號碼；MEMBER、PLATFORM 必填（平台配發），MOBILE、MOICA 由 Core 帶入 */
  readonly typeCode?: string;
}

export interface TurnkeyZeroRatedInput {
  /** 71–79 */
  readonly reasonCode: string;
  readonly customsClearance: TurnkeyCustomsClearance;
}

export interface TurnkeyInvoiceAmounts {
  readonly salesAmount: number;
  readonly taxFreeSalesAmount: number;
  readonly zeroRatedSalesAmount: number;
  readonly taxType: TurnkeyTaxType;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly totalAmount: number;
}

export interface TurnkeyInvoiceIssueInput {
  readonly companyTaxId: string;
  readonly deliveryMode: TurnkeyDeliveryMode;
  readonly externalId?: string;
  readonly buyer?: TurnkeyBuyerInput;
  readonly items: readonly TurnkeyInvoiceItemInput[];
  readonly issuedAt?: Date;
  readonly carrier?: TurnkeyCarrierInput;
  readonly donation?: { readonly npoCode: string };
  /** 省略時：沒有載具也沒有捐贈即為 true */
  readonly printed?: boolean;
  readonly zeroRated?: TurnkeyZeroRatedInput;
  /** 特種稅率（課稅別 SPECIAL 時使用），例如 0.25 */
  readonly specialTaxRate?: number;
  readonly mainRemark?: string;
  readonly amounts?: Partial<Omit<TurnkeyInvoiceAmounts, 'taxType' | 'taxRate'>>;
}

/** 已取號、可直接轉成 MIG 的發票 */
export interface TurnkeyInvoiceDocument {
  readonly messageType: TurnkeyMigMessageType.F0401 | TurnkeyMigMessageType.A0101;
  readonly invoiceNumber: string;
  readonly issuedAt: Date;
  readonly seller: TurnkeyParty;
  readonly buyer: TurnkeyParty;
  readonly items: readonly (TurnkeyInvoiceItemInput & { readonly amount: number })[];
  readonly amounts: TurnkeyInvoiceAmounts;
  readonly carrier?: TurnkeyCarrierInput;
  readonly donation?: { readonly npoCode: string };
  readonly printed: boolean;
  readonly randomNumber?: string;
  readonly zeroRated?: TurnkeyZeroRatedInput;
  readonly mainRemark?: string;
}

export interface TurnkeyInvoiceCancelDocument {
  readonly messageType: TurnkeyMigMessageType.F0501 | TurnkeyMigMessageType.A0201 | TurnkeyMigMessageType.F0701;
  readonly invoiceNumber: string;
  readonly invoiceIssuedAt: Date;
  readonly buyerTaxId?: string;
  readonly sellerTaxId: string;
  readonly cancelledAt: Date;
  readonly reason: string;
  readonly remark?: string;
}

export interface TurnkeyAllowanceItemDocument {
  readonly originalInvoiceNumber: string;
  readonly originalInvoiceIssuedAt: Date;
  readonly originalSequenceNumber?: number;
  readonly originalDescription: string;
  readonly quantity: number;
  readonly unit?: string;
  /** 未稅 */
  readonly unitPrice: number;
  /** 未稅，整數 */
  readonly amount: number;
  /** 整數 */
  readonly tax: number;
  readonly taxType: TurnkeyItemTaxType;
}

export interface TurnkeyAllowanceDocument {
  readonly messageType: TurnkeyMigMessageType.G0401 | TurnkeyMigMessageType.B0101;
  readonly allowanceNumber: string;
  readonly allowanceDate: Date;
  readonly seller: TurnkeyParty;
  readonly buyer: TurnkeyParty;
  readonly items: readonly TurnkeyAllowanceItemDocument[];
  readonly taxAmount: number;
  readonly totalAmount: number;
}

export interface TurnkeyAllowanceCancelDocument {
  readonly messageType: TurnkeyMigMessageType.G0501 | TurnkeyMigMessageType.B0201;
  readonly allowanceNumber: string;
  readonly allowanceDate: Date;
  readonly buyerTaxId?: string;
  readonly sellerTaxId: string;
  readonly cancelledAt: Date;
  readonly reason: string;
}

export interface TurnkeyReplyDocument {
  readonly messageType:
    | TurnkeyMigMessageType.A0102
    | TurnkeyMigMessageType.A0202
    | TurnkeyMigMessageType.A0301
    | TurnkeyMigMessageType.A0302
    | TurnkeyMigMessageType.B0102
    | TurnkeyMigMessageType.B0202;
  /** 發票號碼或折讓單號 */
  readonly documentNumber: string;
  /** 原發票日期或折讓日期 */
  readonly documentDate: Date;
  readonly buyerTaxId: string;
  readonly sellerTaxId: string;
  /** 確認、退回或作廢確認的日期時間；A0302 為照抄 A0301 的退回日期時間 */
  readonly repliedAt: Date;
  readonly reason?: string;
  readonly remark?: string;
}

export interface TurnkeyBlankNumberRange {
  readonly begin: string;
  readonly end: string;
}

export interface TurnkeyBlankNumberDocument {
  readonly messageType: TurnkeyMigMessageType.E0402;
  readonly headTaxId: string;
  readonly branchTaxId: string;
  /** 民國年 3 碼＋雙數月，例如 11510 */
  readonly period: string;
  /** 字軌英文 2 碼 */
  readonly track: string;
  readonly ranges: readonly TurnkeyBlankNumberRange[];
}

export type TurnkeyOutboundDocument =
  | TurnkeyInvoiceDocument
  | TurnkeyInvoiceCancelDocument
  | TurnkeyAllowanceDocument
  | TurnkeyAllowanceCancelDocument
  | TurnkeyReplyDocument
  | TurnkeyBlankNumberDocument;
