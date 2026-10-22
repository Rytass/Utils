/**
 * @jest-environment node
 */

import {
  TurnkeyCarrierType,
  TurnkeyDeliveryMode,
  TurnkeyInvoiceIssueInput,
  TurnkeyTaxType,
  TurnkeyValidationCode,
  validateExchangeSeller,
  validateInvoiceInput,
} from '../src';

const now = new Date('2026-10-21T02:30:00Z');

const base: TurnkeyInvoiceIssueInput = {
  companyTaxId: '12345675',
  deliveryMode: TurnkeyDeliveryMode.STORAGE,
  items: [{ description: '定期票', quantity: 2, unitPrice: 640, taxType: TurnkeyTaxType.TAXABLE }],
};

const codes = (input: TurnkeyInvoiceIssueInput): readonly TurnkeyValidationCode[] =>
  validateInvoiceInput(input, { now }).map(issue => issue.code);

describe('validateInvoiceInput', () => {
  it('accepts a printed B2C invoice and a B2B exchange invoice', () => {
    expect(codes(base)).toEqual([]);
    expect(
      codes({
        ...base,
        deliveryMode: TurnkeyDeliveryMode.EXCHANGE,
        buyer: { taxId: '87654322', name: '測試買方有限公司' },
        amounts: { salesAmount: 1280, taxAmount: 64, totalAmount: 1344 },
      }),
    ).toEqual([]);
  });

  it('flags amount mismatches against the computed amounts', () => {
    expect(
      codes({
        ...base,
        buyer: { taxId: '87654322' },
        amounts: { salesAmount: 1000, taxAmount: 60, totalAmount: 1300 },
      }),
    ).toEqual([
      TurnkeyValidationCode.ITEM_SUM_MISMATCH,
      TurnkeyValidationCode.TAX_AMOUNT_MISMATCH,
      TurnkeyValidationCode.TOTAL_AMOUNT_MISMATCH,
    ]);
  });

  it('flags empty items, bad item amounts and zero totals', () => {
    expect(codes({ ...base, items: [] })).toContain(TurnkeyValidationCode.ITEM_SUM_MISMATCH);
    expect(codes({ ...base, items: [{ ...base.items[0], amount: 999 }] })).toEqual([
      TurnkeyValidationCode.ITEM_SUM_MISMATCH,
    ]);

    expect(codes({ ...base, items: [{ ...base.items[0], unitPrice: 0 }] })).toEqual([
      TurnkeyValidationCode.TOTAL_AMOUNT_MISMATCH,
    ]);
  });

  it('checks the buyer tax id checksum and exchange requirements', () => {
    expect(codes({ ...base, buyer: { taxId: '10000072' } })).toEqual([TurnkeyValidationCode.INVALID_TAX_ID]);
    expect(codes({ ...base, deliveryMode: TurnkeyDeliveryMode.EXCHANGE })).toEqual([
      TurnkeyValidationCode.BUYER_TAX_ID_REQUIRED,
    ]);

    expect(
      codes({
        ...base,
        deliveryMode: TurnkeyDeliveryMode.EXCHANGE,
        buyer: { taxId: '87654322' },
        items: [...base.items, { description: '免稅品', quantity: 1, unitPrice: 10, taxType: TurnkeyTaxType.TAX_FREE }],
      }),
    ).toEqual([TurnkeyValidationCode.TAX_TYPE_NOT_ALLOWED]);
  });

  it('validates carrier formats', () => {
    expect(codes({ ...base, carrier: { type: TurnkeyCarrierType.MOBILE, code: '/ABC+123' } })).toEqual([]);
    expect(codes({ ...base, carrier: { type: TurnkeyCarrierType.MOBILE, code: 'ABC+1234' } })).toEqual([
      TurnkeyValidationCode.INVALID_CARRIER,
    ]);

    expect(codes({ ...base, carrier: { type: TurnkeyCarrierType.MOICA, code: 'AB12345678901234' } })).toEqual([]);
    expect(codes({ ...base, carrier: { type: TurnkeyCarrierType.MEMBER, code: 'M0001' } })).toEqual([
      TurnkeyValidationCode.INVALID_CARRIER,
    ]);

    expect(codes({ ...base, carrier: { type: TurnkeyCarrierType.MEMBER, code: 'M0001', typeCode: 'EG0001' } })).toEqual(
      [],
    );
  });

  it('enforces donation and print-mark rules', () => {
    expect(codes({ ...base, donation: { npoCode: '25885' } })).toEqual([]);
    expect(codes({ ...base, donation: { npoCode: '12' } })).toEqual([TurnkeyValidationCode.UNKNOWN_NPO_CODE]);
    expect(codes({ ...base, buyer: { taxId: '87654322' }, donation: { npoCode: '25885' } })).toEqual([
      TurnkeyValidationCode.DONATION_NOT_ALLOWED,
    ]);

    expect(codes({ ...base, printed: false })).toEqual([TurnkeyValidationCode.PRINT_MARK_REQUIRED]);
    expect(codes({ ...base, printed: true, carrier: { type: TurnkeyCarrierType.MOBILE, code: '/ABC+123' } })).toEqual([
      TurnkeyValidationCode.PRINT_MARK_REQUIRED,
    ]);
  });

  it('allows a mobile barcode on a printed invoice only when the buyer has a tax id', () => {
    const carrier = { type: TurnkeyCarrierType.MOBILE, code: '/ABC+123' };

    expect(codes({ ...base, buyer: { taxId: '87654322' }, printed: true, carrier })).toEqual([]);
    expect(
      codes({
        ...base,
        buyer: { taxId: '87654322' },
        printed: true,
        carrier: { type: TurnkeyCarrierType.MOICA, code: 'AB12345678901234' },
      }),
    ).toEqual([TurnkeyValidationCode.PRINT_MARK_REQUIRED]);
  });

  it('requires zero-rated fields when zero-rated items exist', () => {
    const items = [{ description: '外銷', quantity: 1, unitPrice: 100, taxType: TurnkeyTaxType.ZERO_RATED }];

    expect(codes({ ...base, items })).toEqual([TurnkeyValidationCode.ZERO_RATED_FIELDS_REQUIRED]);
    expect(codes({ ...base, items, zeroRated: { reasonCode: '70', customsClearance: undefined as never } })).toEqual([
      TurnkeyValidationCode.ZERO_RATED_FIELDS_REQUIRED,
    ]);
  });

  it('rejects issue dates far in the future or past the upload deadline', () => {
    expect(codes({ ...base, issuedAt: new Date(now.getTime() + 2 * 86400000) })).toEqual([]);
    expect(codes({ ...base, issuedAt: new Date(now.getTime() + 4 * 86400000) })).toEqual([
      TurnkeyValidationCode.ISSUED_IN_FUTURE,
    ]);

    expect(codes({ ...base, issuedAt: new Date(now.getTime() - 49 * 3600000) })).toEqual([
      TurnkeyValidationCode.ISSUE_DEADLINE_PASSED,
    ]);

    expect(codes({ ...base, buyer: { taxId: '87654322' }, issuedAt: new Date(now.getTime() - 6 * 86400000) })).toEqual(
      [],
    );

    expect(codes({ ...base, buyer: { taxId: '87654322' }, issuedAt: new Date(now.getTime() - 8 * 86400000) })).toEqual([
      TurnkeyValidationCode.ISSUE_DEADLINE_PASSED,
    ]);
  });

  it('rejects special-rate items mixed with other tax types or without a rate', () => {
    const special = { description: '酒', quantity: 1, unitPrice: 100, taxType: TurnkeyTaxType.SPECIAL };

    expect(codes({ ...base, buyer: { taxId: '87654322' }, items: [...base.items, special] })).toEqual(
      expect.arrayContaining([TurnkeyValidationCode.TAX_TYPE_NOT_ALLOWED]),
    );

    expect(codes({ ...base, buyer: { taxId: '87654322' }, items: [special] })).toEqual([
      TurnkeyValidationCode.TAX_TYPE_NOT_ALLOWED,
    ]);

    expect(codes({ ...base, buyer: { taxId: '87654322' }, items: [special], specialTaxRate: 0.25 })).toEqual([]);
  });

  it('rejects malformed items before computing amounts', () => {
    const malformed = (items: unknown): TurnkeyInvoiceIssueInput =>
      ({ ...base, items }) as unknown as TurnkeyInvoiceIssueInput;

    expect(codes(malformed(undefined))).toEqual([TurnkeyValidationCode.ITEM_SUM_MISMATCH]);
    expect(codes(malformed([{ description: 'x', quantity: '2', unitPrice: 10, taxType: 'TAXABLE' }]))).toEqual([
      TurnkeyValidationCode.ITEM_SUM_MISMATCH,
    ]);

    expect(codes(malformed([{ description: 'x', quantity: 1, unitPrice: 10, taxType: 'MIXED' }]))).toEqual([
      TurnkeyValidationCode.ITEM_SUM_MISMATCH,
    ]);
  });
});

describe('validateExchangeSeller', () => {
  it('requires a seller address for exchange', () => {
    expect(validateExchangeSeller(TurnkeyDeliveryMode.EXCHANGE, { address: null })).toEqual([
      expect.objectContaining({ code: TurnkeyValidationCode.SELLER_ADDRESS_REQUIRED, field: 'companyTaxId' }),
    ]);

    expect(validateExchangeSeller(TurnkeyDeliveryMode.EXCHANGE, { address: '   ' })).toHaveLength(1);
    expect(validateExchangeSeller(TurnkeyDeliveryMode.EXCHANGE, { address: '測試地址' })).toEqual([]);
  });

  it('does not need an address outside exchange', () => {
    expect(validateExchangeSeller(TurnkeyDeliveryMode.STORAGE, { address: null })).toEqual([]);
  });
});
