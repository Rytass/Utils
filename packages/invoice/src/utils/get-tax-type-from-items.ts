import { InvoicePaymentItem, TaxType } from '../typings';

export function getTaxTypeFromItems(items: InvoicePaymentItem[]): TaxType {
  const { hasTaxed, hasTaxFree, hasZeroTax, hasSpecial } = items.reduce(
    (results, item) => {
      switch (item.taxType) {
        case TaxType.ZERO_TAX:
          return {
            ...results,
            hasZeroTax: true,
          };

        case TaxType.SPECIAL:
          return {
            ...results,
            hasSpecial: true,
          };

        case TaxType.TAX_FREE:
          return {
            ...results,
            hasTaxFree: true,
          };

        case TaxType.TAXED:
        default:
          return {
            ...results,
            hasTaxed: true,
          };
      }
    },
    {
      hasTaxed: false,
      hasTaxFree: false,
      hasZeroTax: false,
      hasSpecial: false,
    },
  );

  if ([hasTaxed, hasTaxFree, hasZeroTax, hasSpecial].reduce((sum, flag) => sum + (flag ? 1 : 0), 0) > 1) {
    if (hasTaxFree && hasZeroTax) throw new Error('Zero tax and tax free item cannot both in one invoice');
    if (hasTaxed && hasSpecial) return TaxType.SPECIAL;

    return TaxType.MIXED;
  }

  if (hasTaxFree) return TaxType.TAX_FREE;
  if (hasZeroTax) return TaxType.ZERO_TAX;
  if (hasSpecial) return TaxType.SPECIAL;

  return TaxType.TAXED;
}
