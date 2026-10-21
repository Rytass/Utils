export enum TurnkeyDeliveryMode {
  STORAGE = 'STORAGE',
  EXCHANGE = 'EXCHANGE',
}

export enum TurnkeyTaxType {
  TAXABLE = 'TAXABLE',
  ZERO_RATED = 'ZERO_RATED',
  TAX_FREE = 'TAX_FREE',
  SPECIAL = 'SPECIAL',
  MIXED = 'MIXED',
}

export enum TurnkeyCarrierType {
  MOBILE = 'MOBILE',
  MOICA = 'MOICA',
  MEMBER = 'MEMBER',
  PLATFORM = 'PLATFORM',
}

export enum TurnkeyCustomsClearance {
  NOT_VIA_CUSTOMS = 'NOT_VIA_CUSTOMS',
  VIA_CUSTOMS = 'VIA_CUSTOMS',
}

export enum TurnkeyInvoiceStatus {
  SUBMITTED = 'SUBMITTED',
  ISSUED = 'ISSUED',
  FAILED = 'FAILED',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  REJECTION_ACKNOWLEDGED = 'REJECTION_ACKNOWLEDGED',
  VOID_PENDING = 'VOID_PENDING',
  VOIDED = 'VOIDED',
  ANNULLED = 'ANNULLED',
}

export enum TurnkeyAllowanceStatus {
  SUBMITTED = 'SUBMITTED',
  ISSUED = 'ISSUED',
  FAILED = 'FAILED',
  CONFIRMED = 'CONFIRMED',
  VOID_PENDING = 'VOID_PENDING',
  VOIDED = 'VOIDED',
}

export enum TurnkeyNumberStatus {
  AVAILABLE = 'AVAILABLE',
  ALLOCATED = 'ALLOCATED',
  SUBMITTED = 'SUBMITTED',
  RETURNED = 'RETURNED',
  ABANDONED = 'ABANDONED',
  USED = 'USED',
}

export enum TurnkeySubmissionStatus {
  PENDING = 'PENDING',
  WRITTEN = 'WRITTEN',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

export enum TurnkeyMigMessageType {
  A0101 = 'A0101',
  A0102 = 'A0102',
  A0201 = 'A0201',
  A0202 = 'A0202',
  A0301 = 'A0301',
  A0302 = 'A0302',
  B0101 = 'B0101',
  B0102 = 'B0102',
  B0201 = 'B0201',
  B0202 = 'B0202',
  E0402 = 'E0402',
  F0401 = 'F0401',
  F0501 = 'F0501',
  F0701 = 'F0701',
  G0401 = 'G0401',
  G0501 = 'G0501',
}

/** Turnkey UpCast 第一層目錄 */
export enum TurnkeyMessageCategory {
  B2SSTORAGE = 'B2SSTORAGE',
  B2BEXCHANGE = 'B2BEXCHANGE',
  B2PMESSAGE = 'B2PMESSAGE',
}

export enum TurnkeyProofFormat {
  JSON = 'JSON',
  PDF = 'PDF',
  PNG = 'PNG',
  ESC_POS = 'ESC_POS',
  A4_PDF = 'A4_PDF',
}

export enum TurnkeyEnvironment {
  TEST = 'TEST',
  PRODUCTION = 'PRODUCTION',
}

export enum TurnkeyPrintDocumentType {
  INVOICE = 'INVOICE',
  ALLOWANCE = 'ALLOWANCE',
}
