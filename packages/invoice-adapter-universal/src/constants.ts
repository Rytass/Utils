import { TaxType } from '@rytass/invoice';

export enum UniversalBaseUrls {
  DEVELOPMENT = 'https://webtest.einvoice.com.tw/einv',
  PRODUCTION = 'https://web.einvoice.com.tw/einv',
}

export const UNIVERSAL_B2C_BUYER_ID = '0000000000';

export const UNIVERSAL_DEFAULT_INVOICE_TYPE = '07';

export const UNIVERSAL_TAX_RATE = 0.05;

export const UniversalTaxTypeCode = {
  [TaxType.TAXED]: '1',
  [TaxType.ZERO_TAX]: '2',
  [TaxType.TAX_FREE]: '3',
  [TaxType.SPECIAL]: '4',
  [TaxType.MIXED]: '9',
} as const satisfies Record<TaxType, '1' | '2' | '3' | '4' | '9'>;

export const ReverseUniversalTaxTypeCode = {
  '1': TaxType.TAXED,
  '2': TaxType.ZERO_TAX,
  '3': TaxType.TAX_FREE,
  '4': TaxType.SPECIAL,
  '9': TaxType.MIXED,
} as const satisfies Record<'1' | '2' | '3' | '4' | '9', TaxType>;
