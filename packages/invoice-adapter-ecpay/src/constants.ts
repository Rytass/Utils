import { CustomsMark, InvoiceCarrierType, TaxType } from '@rytass/invoice';

export const ECPayCustomsMark = {
  [CustomsMark.NO]: '1',
  [CustomsMark.YES]: '2',
}

export const ECPayCarrierTypeCode = {
  [InvoiceCarrierType.PRINT]: '',
  [InvoiceCarrierType.LOVE_CODE]: '',
  [InvoiceCarrierType.MEMBER]: '1',
  [InvoiceCarrierType.PLATFORM]: '1',
  [InvoiceCarrierType.MOICA]: '2',
  [InvoiceCarrierType.MOBILE]: '3',
}

export const ECPayTaxTypeCode = {
  [TaxType.TAXED]: '1',
  [TaxType.TAX_FREE]: '2',
  [TaxType.ZERO_TAX]: '3',
  [TaxType.SPECIAL]: '4',
  [TaxType.MIXED]: '9',
}

export const ECPAY_INVOICE_SUCCESS_CODE = 1;
export const ECPAY_INVOICE_NOT_FOUND = 1600003;

export const ECPAY_COMPRESSED_ITEM_NAME = 'ECPAY/COMPRESS_ITEM';
export const ECPAY_RANDOM_CODE = 'XXXX';
