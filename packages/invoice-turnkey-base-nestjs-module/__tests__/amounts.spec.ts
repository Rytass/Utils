/**
 * @jest-environment node
 */

import {
  computeInvoiceAmounts,
  formatPeriod,
  formatPeriodLabel,
  formatRocDate,
  isTaxIdValid,
  splitAllowanceAmount,
  TurnkeyTaxType,
} from '../src';

describe('isTaxIdValid', () => {
  it.each(['12345675', '87654322'])('accepts %s', taxId => {
    expect(isTaxIdValid(taxId)).toBe(true);
  });

  it.each(['12345678', '1234567', 'ABCDEFGH', '12345674'])('rejects %s', taxId => {
    expect(isTaxIdValid(taxId)).toBe(false);
  });

  it('accepts the seventh-digit-7 special case', () => {
    // 1,0,0,0,0,0,7,3 × 權數 → 1+0+0+0+0+0+(2+8)+3 = 14，不被 5 整除；第 7 碼為 7，14+1 = 15 可整除
    expect(isTaxIdValid('10000073')).toBe(true);
    expect(isTaxIdValid('10000072')).toBe(false);
  });
});

describe('computeInvoiceAmounts', () => {
  it('adds 5% tax for B2B', () => {
    expect(
      computeInvoiceAmounts([{ description: 'a', quantity: 3, unitPrice: 33, taxType: TurnkeyTaxType.TAXABLE }], {
        isB2B: true,
      }),
    ).toEqual({
      salesAmount: 99,
      taxFreeSalesAmount: 0,
      zeroRatedSalesAmount: 0,
      taxType: TurnkeyTaxType.TAXABLE,
      taxRate: 0.05,
      taxAmount: 5,
      totalAmount: 104,
    });
  });

  it('keeps tax-inclusive amounts with zero tax for B2C', () => {
    const amounts = computeInvoiceAmounts(
      [
        { description: 'a', quantity: 1, unitPrice: 100, taxType: TurnkeyTaxType.TAXABLE },
        { description: 'b', quantity: 1, unitPrice: 50, taxType: TurnkeyTaxType.TAX_FREE },
      ],
      { isB2B: false },
    );

    expect(amounts).toMatchObject({ salesAmount: 100, taxFreeSalesAmount: 50, taxType: TurnkeyTaxType.MIXED });
    expect(amounts.taxAmount).toBe(0);
    expect(amounts.totalAmount).toBe(150);
  });

  it('avoids floating point drift on decimal quantities', () => {
    const amounts = computeInvoiceAmounts(
      [{ description: 'a', quantity: 0.1, unitPrice: 3, taxType: TurnkeyTaxType.ZERO_RATED }],
      { isB2B: true },
    );

    expect(amounts.zeroRatedSalesAmount).toBe(0);
    expect(amounts.taxRate).toBe(0);
  });
});

describe('splitAllowanceAmount', () => {
  it('splits a B2C tax-inclusive amount into integer untaxed amount and tax', () => {
    expect(splitAllowanceAmount(105, TurnkeyTaxType.TAXABLE, { isB2B: false })).toEqual({ amount: 100, tax: 5 });
    expect(splitAllowanceAmount(50, TurnkeyTaxType.TAXABLE, { isB2B: false })).toEqual({ amount: 48, tax: 2 });
  });

  it('adds tax for B2B', () => {
    expect(splitAllowanceAmount(50, TurnkeyTaxType.TAXABLE, { isB2B: true })).toEqual({ amount: 50, tax: 3 });
    expect(splitAllowanceAmount(50, TurnkeyTaxType.TAX_FREE, { isB2B: true })).toEqual({ amount: 50, tax: 0 });
  });
});

describe('period helpers', () => {
  it('formats ROC dates and bi-monthly periods in Taipei time', () => {
    const date = new Date('2026-08-31T17:00:00Z'); // 台北 2026-09-01 01:00

    expect(formatRocDate(date)).toBe('1150901');
    expect(formatPeriod(date)).toBe('11510');
    expect(formatPeriodLabel('11510')).toBe('115年09-10月');
  });
});
