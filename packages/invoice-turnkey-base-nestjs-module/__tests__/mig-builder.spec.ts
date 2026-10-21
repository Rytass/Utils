/**
 * @jest-environment node
 */

import { XMLParser } from 'fast-xml-parser';
import {
  buildMigXml,
  computeInvoiceAmounts,
  TurnkeyCarrierType,
  TurnkeyCustomsClearance,
  TurnkeyInvoiceDocument,
  TurnkeyMigMessageType,
  TurnkeyOutboundDocument,
  TurnkeyTaxType,
} from '../src';

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

const issuedAt = new Date('2026-10-21T02:30:00Z'); // 台北 10:30:00
const seller = { taxId: '12345675', name: '測試賣方股份有限公司', address: '台北市信義區測試路 1 號' };

const b2bInvoice = (messageType: TurnkeyMigMessageType.F0401 | TurnkeyMigMessageType.A0101): TurnkeyInvoiceDocument => {
  const items = [{ description: '定期票', quantity: 1, unitPrice: 100, taxType: TurnkeyTaxType.TAXABLE, amount: 100 }];

  return {
    messageType,
    invoiceNumber: 'ZZ00000600',
    issuedAt,
    seller,
    buyer: { taxId: '87654322', name: '測試買方有限公司' },
    items,
    amounts: computeInvoiceAmounts(items, { isB2B: true }),
    printed: true,
    randomNumber: messageType === TurnkeyMigMessageType.F0401 ? '1234' : undefined,
  };
};

describe('buildMigXml', () => {
  it('builds a B2B F0401 matching the verified sample', () => {
    const xml = buildMigXml(b2bInvoice(TurnkeyMigMessageType.F0401));
    const parsed = parser.parse(xml);

    expect(parsed.Invoice['@_xmlns']).toBe('urn:GEINV:eInvoiceMessage:F0401:4.1');
    expect(parsed.Invoice.Main.InvoiceDate).toBe('20261021');
    expect(parsed.Invoice.Main.InvoiceTime).toBe('10:30:00');
    expect(parsed.Invoice.Main.PrintMark).toBe('Y');
    expect(parsed.Invoice.Amount).toEqual({
      SalesAmount: '100',
      FreeTaxSalesAmount: '0',
      ZeroTaxSalesAmount: '0',
      TaxType: '1',
      TaxRate: '0.05',
      TaxAmount: '5',
      TotalAmount: '105',
    });
  });

  it('omits storage-only fields on A0101', () => {
    const xml = buildMigXml(b2bInvoice(TurnkeyMigMessageType.A0101));
    const parsed = parser.parse(xml);

    expect(parsed.Invoice.Main.PrintMark).toBeUndefined();
    expect(parsed.Invoice.Main.RandomNumber).toBeUndefined();
    expect(parsed.Invoice.Amount.FreeTaxSalesAmount).toBeUndefined();
  });

  it('builds B2C carrier, donation, zero-rated and mixed invoices', () => {
    const mixedItems = [
      { description: '應稅品項', quantity: 1, unitPrice: 100, taxType: TurnkeyTaxType.TAXABLE, amount: 100 },
      { description: '免稅品項', quantity: 1, unitPrice: 50, taxType: TurnkeyTaxType.TAX_FREE, amount: 50 },
    ];

    const zeroItems = [
      { description: '外銷貨物', quantity: 1, unitPrice: 100, taxType: TurnkeyTaxType.ZERO_RATED, amount: 100 },
    ];

    const consumer = { taxId: '0000000000', name: '消費者' };

    const docs: TurnkeyInvoiceDocument[] = [
      {
        ...b2bInvoice(TurnkeyMigMessageType.F0401),
        buyer: consumer,
        amounts: computeInvoiceAmounts(b2bInvoice(TurnkeyMigMessageType.F0401).items, { isB2B: false }),
        carrier: { type: TurnkeyCarrierType.MOBILE, code: '/ABC+123' },
        printed: false,
      },
      {
        ...b2bInvoice(TurnkeyMigMessageType.F0401),
        buyer: consumer,
        amounts: computeInvoiceAmounts(b2bInvoice(TurnkeyMigMessageType.F0401).items, { isB2B: false }),
        donation: { npoCode: '25885' },
        printed: false,
      },
      {
        ...b2bInvoice(TurnkeyMigMessageType.F0401),
        items: zeroItems,
        amounts: computeInvoiceAmounts(zeroItems, { isB2B: true }),
        zeroRated: { reasonCode: '71', customsClearance: TurnkeyCustomsClearance.VIA_CUSTOMS },
      },
      {
        ...b2bInvoice(TurnkeyMigMessageType.F0401),
        buyer: consumer,
        items: mixedItems,
        amounts: computeInvoiceAmounts(mixedItems, { isB2B: false }),
      },
    ];

    const [carrier, donation, zero, mixed] = docs.map(doc => parser.parse(buildMigXml(doc)).Invoice);

    expect(carrier.Main.CarrierType).toBe('3J0002');
    expect(carrier.Main.CarrierId2).toBe('/ABC+123');
    expect(carrier.Amount.TaxAmount).toBe('0');
    expect(donation.Main.DonateMark).toBe('1');
    expect(donation.Main.NPOBAN).toBe('25885');
    expect(zero.Main.CustomsClearanceMark).toBe('2');
    expect(zero.Main.ZeroTaxRateReason).toBe('71');
    expect(zero.Amount.ZeroTaxSalesAmount).toBe('100');
    expect(zero.Amount.TaxRate).toBe('0');
    expect(mixed.Amount.TaxType).toBe('9');
    expect(mixed.Amount.FreeTaxSalesAmount).toBe('50');
    expect(mixed.Details.ProductItem).toHaveLength(2);
  });

  it('builds cancel, annul, allowance, reply and blank-number messages with the MIG root elements', () => {
    const allowanceItem = {
      originalInvoiceNumber: 'ZZ00000600',
      originalInvoiceIssuedAt: issuedAt,
      originalSequenceNumber: 1,
      originalDescription: '定期票',
      quantity: 1,
      unitPrice: 50,
      amount: 50,
      tax: 3,
      taxType: TurnkeyTaxType.TAXABLE as const,
    };

    const docs: TurnkeyOutboundDocument[] = [
      ...([TurnkeyMigMessageType.F0501, TurnkeyMigMessageType.A0201, TurnkeyMigMessageType.F0701] as const).map(
        messageType => ({
          messageType,
          invoiceNumber: 'ZZ00000600',
          invoiceIssuedAt: issuedAt,
          buyerTaxId: '87654322',
          sellerTaxId: '12345675',
          cancelledAt: issuedAt,
          reason: '測試',
        }),
      ),
      ...([TurnkeyMigMessageType.G0401, TurnkeyMigMessageType.B0101] as const).map(messageType => ({
        messageType,
        allowanceNumber: 'AL00000001',
        allowanceDate: issuedAt,
        seller,
        buyer: { taxId: '87654322', name: '測試買方有限公司' },
        items: [allowanceItem],
        taxAmount: 3,
        totalAmount: 50,
      })),
      ...([TurnkeyMigMessageType.G0501, TurnkeyMigMessageType.B0201] as const).map(messageType => ({
        messageType,
        allowanceNumber: 'AL00000001',
        allowanceDate: issuedAt,
        buyerTaxId: '87654322',
        sellerTaxId: '12345675',
        cancelledAt: issuedAt,
        reason: '測試',
      })),
      ...(
        [
          TurnkeyMigMessageType.A0102,
          TurnkeyMigMessageType.A0202,
          TurnkeyMigMessageType.A0301,
          TurnkeyMigMessageType.A0302,
          TurnkeyMigMessageType.B0102,
          TurnkeyMigMessageType.B0202,
        ] as const
      ).map(messageType => ({
        messageType,
        documentNumber: messageType.startsWith('B') ? 'AL00000001' : 'ZZ00000600',
        documentDate: issuedAt,
        buyerTaxId: '87654322',
        sellerTaxId: '12345675',
        repliedAt: issuedAt,
        reason: '品項錯誤',
      })),
      {
        messageType: TurnkeyMigMessageType.E0402,
        headTaxId: '12345675',
        branchTaxId: '12345675',
        period: '11510',
        track: 'ZZ',
        ranges: [
          { begin: '00000640', end: '00000649' },
          { begin: '00000620', end: '00000620' },
        ],
      },
    ];

    const roots = docs.map(doc => {
      const xml = buildMigXml(doc);

      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);

      const parsed = parser.parse(xml);
      const root = Object.keys(parsed).find(key => key !== '?xml') as string;

      expect(parsed[root]['@_xmlns']).toBe(`urn:GEINV:eInvoiceMessage:${doc.messageType}:4.1`);

      return root;
    });

    expect(roots).toEqual([
      'CancelInvoice',
      'CancelInvoice',
      'VoidInvoice',
      'Allowance',
      'Allowance',
      'CancelAllowance',
      'CancelAllowance',
      'InvoiceConfirm',
      'CancelInvoiceConfirm',
      'RejectInvoice',
      'RejectInvoiceConfirm',
      'AllowanceConfirm',
      'CancelAllowanceConfirm',
      'BranchTrackBlank',
    ]);

    const cancel = parser.parse(buildMigXml(docs[0])).CancelInvoice;

    expect(cancel).toMatchObject({
      CancelInvoiceNumber: 'ZZ00000600',
      InvoiceDate: '20261021',
      BuyerId: '87654322',
      SellerId: '12345675',
      CancelDate: '20261021',
      CancelTime: '10:30:00',
    });

    const allowance = parser.parse(buildMigXml(docs[3])).Allowance;

    expect(allowance.Main.AllowanceType).toBe('2');
    expect(allowance.Details.ProductItem).toMatchObject({ Amount: '50', Tax: '3', TaxType: '1' });
    expect(allowance.Amount).toEqual({ TaxAmount: '3', TotalAmount: '50' });

    const rejectConfirm = parser.parse(buildMigXml(docs[10])).RejectInvoiceConfirm;

    // A0302 的 RejectDate/RejectTime 照抄 A0301（repliedAt 由呼叫端帶入 A0301 的退回時間）
    expect(rejectConfirm).toMatchObject({ RejectDate: '20261021', RejectTime: '10:30:00' });
    expect(rejectConfirm.RejectReason).toBeUndefined();

    const annul = parser.parse(buildMigXml(docs[2])).VoidInvoice;

    expect(annul.VoidInvoiceNumber).toBe('ZZ00000600');
    expect(annul.VoidReason).toBe('測試');

    const blank = parser.parse(buildMigXml(docs[docs.length - 1])).BranchTrackBlank;

    expect(blank.Details.BranchTrackBlankItem).toHaveLength(2);
  });

  it('escapes XML special characters in free text', () => {
    const doc = { ...b2bInvoice(TurnkeyMigMessageType.F0401), mainRemark: 'A&B <C>' };
    const xml = buildMigXml(doc);

    expect(xml).toContain('A&amp;B &lt;C&gt;');
  });
});
