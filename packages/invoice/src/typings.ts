
export enum InvoiceCarrierType {
  PRINT = 'PRINT',
  MOBILE = 'MOBILE',
  MOICA = 'MOICA',
  LOVE_CODE = 'LOVE_CODE',
  MEMBER = 'MEMBER',
  PLATFORM = 'PLATFORM',
}

interface InvoiceCarrierBase {
  type: InvoiceCarrierType;
}

export interface InvoicePrintCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.PRINT;
}

export interface InvoiceMobileCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.MOBILE;
  code: string;
}

export interface InvoiceMoicaCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.MOICA;
  code: string;
}

export interface InvoiceLoveCodeCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.LOVE_CODE;
  code: string;
}

export interface InvoicMemberCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.MEMBER;
  code: string;
}

export interface InvoicPlatformCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.PLATFORM;
  code: string;
}

export type InvoiceCarrier = InvoicePrintCarrier
  | InvoiceMobileCarrier
  | InvoiceMoicaCarrier
  | InvoiceLoveCodeCarrier
  | InvoicMemberCarrier
  | InvoicPlatformCarrier;

export const InvoiceCarriers = {
  PRINT: { type: InvoiceCarrierType.PRINT } as InvoicePrintCarrier,
  MEMBER: { type: InvoiceCarrierType.MEMBER } as InvoicMemberCarrier,
  PLATFORM: { type: InvoiceCarrierType.PLATFORM } as InvoicPlatformCarrier,
  LOVE_CODE: (loveCode: string) => ({
    type: InvoiceCarrierType.LOVE_CODE,
    code: loveCode,
  } as InvoiceLoveCodeCarrier),
  MOBILE: (barcode: string) => ({
    type: InvoiceCarrierType.MOBILE,
    code: barcode,
  } as InvoiceMobileCarrier),
  MOICA: (barcode: string) => ({
    type: InvoiceCarrierType.MOICA,
    code: barcode,
  } as InvoiceMoicaCarrier),
};

export enum TaxType {
  TAXED = 'TAXED',
  TAX_FREE = 'TAX_FREE',
  ZERO_TAX = 'ZERO_TAX',
  SPECIAL = 'SPECIAL',
  MIXED = 'MIXED',
}

export enum SpecialTaxCode {
  TEA = 1,
  CLUB = 2,
  BANK_SELF = 3,
  INSURANCE = 4,
  BANK_COMMON = 5,
  BANK_SELF_SALES_BEFORE_103 = 6,
  BANK_SELF_SALES_AFTER_103 = 7,
  FREE = 8,
}

interface TaxBase {
  type: TaxType;
}

interface CommonTax extends TaxBase {
  type: Exclude<TaxType, TaxType.SPECIAL>;
}

interface SpecialTax extends TaxBase {
  type: TaxType.SPECIAL;
  taxCode: SpecialTaxCode;
}

export type InvoiceTax = CommonTax | SpecialTax;

export enum InvoiceState {
  INITED = 'INITED',
  ISSUED = 'ISSUED',
  VOID = 'VOID',
  ALLOWANCED = 'ALLOWANCED',
}

export interface InvoiceAllowance {
  allowanceNumber: string;

  allowancePrice: number;

  allowancedOn: Date;

  remainingAmount: number;
}

export enum CustomsMark {
  YES = 'YES',
  NO = 'NO',
}
