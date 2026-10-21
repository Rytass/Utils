import { TurnkeyTaxType } from '../typings/turnkey-enums';
import { TurnkeyInvoiceAmounts, TurnkeyInvoiceItemInput, TurnkeyItemTaxType } from '../typings/turnkey-invoice.types';

export const GENERAL_TAX_RATE = 0.05;

export const TAX_TYPE_CODE: Readonly<Record<TurnkeyTaxType, string>> = {
  [TurnkeyTaxType.TAXABLE]: '1',
  [TurnkeyTaxType.ZERO_RATED]: '2',
  [TurnkeyTaxType.TAX_FREE]: '3',
  [TurnkeyTaxType.SPECIAL]: '4',
  [TurnkeyTaxType.MIXED]: '9',
};

export const TAX_TYPE_FROM_CODE: Readonly<Record<string, TurnkeyTaxType>> = Object.fromEntries(
  Object.entries(TAX_TYPE_CODE).map(([type, code]) => [code, type as TurnkeyTaxType]),
);

/** 金額計算到小數 7 位後四捨五入，避免浮點誤差 */
export const roundTo = (value: number, digits = 7): number => {
  const factor = 10 ** digits;

  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const itemAmount = (item: TurnkeyInvoiceItemInput): number =>
  item.amount ?? roundTo(item.quantity * item.unitPrice);

const sumBy = (
  items: readonly TurnkeyInvoiceItemInput[],
  predicate: (taxType: TurnkeyItemTaxType) => boolean,
): number => roundTo(items.filter(item => predicate(item.taxType)).reduce((sum, item) => sum + itemAmount(item), 0));

export const resolveInvoiceTaxType = (items: readonly TurnkeyInvoiceItemInput[]): TurnkeyTaxType => {
  const types = Array.from(new Set(items.map(item => item.taxType)));

  return types.length === 1 ? types[0] : TurnkeyTaxType.MIXED;
};

export interface ComputeInvoiceAmountsOptions {
  /** 有買方統編（B2B）時稅額外加；消費者（B2C）以含稅金額開立，稅額 0 */
  readonly isB2B: boolean;
  readonly specialTaxRate?: number;
}

/**
 * 依明細算出 MIG Amount 區塊。
 * - B2B：明細為未稅金額，稅額 = 應稅銷售額 × 稅率後四捨五入。
 * - B2C：明細為含稅金額，銷售額含稅、稅額 0。
 * 特種稅率（SPECIAL）併入 SalesAmount，稅率取 specialTaxRate。
 */
export const computeInvoiceAmounts = (
  items: readonly TurnkeyInvoiceItemInput[],
  options: ComputeInvoiceAmountsOptions,
): TurnkeyInvoiceAmounts => {
  const taxType = resolveInvoiceTaxType(items);
  const hasSpecial = items.some(item => item.taxType === TurnkeyTaxType.SPECIAL);
  const hasTaxable = items.some(item => item.taxType === TurnkeyTaxType.TAXABLE);

  const salesAmount = Math.round(
    sumBy(items, type => type === TurnkeyTaxType.TAXABLE || type === TurnkeyTaxType.SPECIAL),
  );

  const taxFreeSalesAmount = Math.round(sumBy(items, type => type === TurnkeyTaxType.TAX_FREE));
  const zeroRatedSalesAmount = Math.round(sumBy(items, type => type === TurnkeyTaxType.ZERO_RATED));

  const taxRate = hasSpecial ? (options.specialTaxRate ?? 0) : hasTaxable ? GENERAL_TAX_RATE : 0;
  const taxAmount = options.isB2B ? Math.round(salesAmount * taxRate) : 0;

  return {
    salesAmount,
    taxFreeSalesAmount,
    zeroRatedSalesAmount,
    taxType,
    taxRate,
    taxAmount,
    totalAmount: salesAmount + taxFreeSalesAmount + zeroRatedSalesAmount + taxAmount,
  };
};

/**
 * 折讓的 Amount 與 Tax 必須是整數且 Amount 為未稅金額。
 * B2C 原發票是含稅金額，拆成未稅金額與稅額：未稅 = 含稅 ÷ (1 + 稅率) 四捨五入，稅額 = 含稅 − 未稅。
 */
export const splitAllowanceAmount = (
  amount: number,
  taxType: TurnkeyItemTaxType,
  options: { readonly isB2B: boolean; readonly specialTaxRate?: number },
): { readonly amount: number; readonly tax: number } => {
  const rate =
    taxType === TurnkeyTaxType.TAXABLE
      ? GENERAL_TAX_RATE
      : taxType === TurnkeyTaxType.SPECIAL
        ? (options.specialTaxRate ?? 0)
        : 0;

  if (options.isB2B) {
    const untaxed = Math.round(amount);

    return { amount: untaxed, tax: Math.round(untaxed * rate) };
  }

  const inclusive = Math.round(amount);
  const untaxed = Math.round(inclusive / (1 + rate));

  return { amount: untaxed, tax: inclusive - untaxed };
};
