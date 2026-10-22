import {
  BaseTurnkeyInvoiceEntity,
  TurnkeyMigMessageType,
  TurnkeyNumberStatus,
  TurnkeyReceivedDocumentEntity,
  TurnkeyReceivedDocumentStatus,
  TurnkeyCarrierType,
  TurnkeyDeliveryMode,
  TurnkeyInvoiceStatus,
  TurnkeyTaxType,
  TurnkeyValidationCode,
  TurnkeyValidationError,
} from '@rytass/invoice-turnkey-base-nestjs-module';
import { IssueTurnkeyInvoiceInput } from '../src/dto/turnkey-invoice.input';
import {
  toBlankNumberReportDto,
  toCompanyDto,
  toInvoiceDto,
  toInvoiceIssueInput,
  toInvoiceNumberDto,
  toItemTaxType,
  toReceivedDocumentDto,
} from '../src/turnkey-graphql.mappers';

const createdAt = new Date('2026-10-20T02:00:00.000Z');

const invoiceEntity = (): BaseTurnkeyInvoiceEntity =>
  ({
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    companyTaxId: '12345675',
    invoiceNumber: 'ZZ00000600',
    externalId: 'order-0007',
    deliveryMode: TurnkeyDeliveryMode.STORAGE,
    status: TurnkeyInvoiceStatus.SUBMITTED,
    issuedAt: createdAt,
    buyerTaxId: '00000000',
    buyerName: '消費者',
    buyerAddress: null,
    taxType: TurnkeyTaxType.TAXABLE,
    taxRate: 0.05,
    salesAmount: 100,
    taxFreeSalesAmount: 0,
    zeroRatedSalesAmount: 0,
    taxAmount: 5,
    totalAmount: 105,
    carrierType: null,
    carrierCode: null,
    carrierHiddenCode: null,
    carrierTypeCode: null,
    npoCode: null,
    printed: true,
    randomNumber: '0123',
    zeroRatedReasonCode: null,
    customsClearance: null,
    mainRemark: null,
    voidedAt: null,
    voidReason: null,
    createdAt,
    updatedAt: createdAt,
    items: [
      {
        id: 'item-2',
        sequenceNumber: 2,
        description: 'B',
        quantity: 1,
        unit: null,
        unitPrice: 50,
        amount: 50,
        taxType: TurnkeyTaxType.TAXABLE,
        remark: null,
      },
      {
        id: 'item-1',
        sequenceNumber: 1,
        description: 'A',
        quantity: 1,
        unit: null,
        unitPrice: 50,
        amount: 50,
        taxType: TurnkeyTaxType.TAXABLE,
        remark: null,
      },
    ],
  }) as unknown as BaseTurnkeyInvoiceEntity;

describe('toItemTaxType', () => {
  it('passes through taxable types', () => {
    expect(toItemTaxType(TurnkeyTaxType.ZERO_RATED)).toBe(TurnkeyTaxType.ZERO_RATED);
  });

  it('rejects MIXED on an item with TAX_TYPE_NOT_ALLOWED', () => {
    try {
      toItemTaxType(TurnkeyTaxType.MIXED);
      throw new Error('expected toItemTaxType to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(TurnkeyValidationError);
      expect((error as TurnkeyValidationError).code).toBe(TurnkeyValidationCode.TAX_TYPE_NOT_ALLOWED);
    }
  });
});

describe('toInvoiceDto', () => {
  it('sorts items by sequence number and copies scalar fields', () => {
    const dto = toInvoiceDto(invoiceEntity());

    expect(dto.items.map(item => item.sequenceNumber)).toEqual([1, 2]);
    expect(dto.invoiceNumber).toBe('ZZ00000600');
    expect(dto.status).toBe(TurnkeyInvoiceStatus.SUBMITTED);
    expect(dto.carrierType).toBeNull();
  });
});

describe('toInvoiceIssueInput', () => {
  const input = (overrides: Partial<IssueTurnkeyInvoiceInput> = {}): IssueTurnkeyInvoiceInput =>
    Object.assign(new IssueTurnkeyInvoiceInput(), {
      deliveryMode: TurnkeyDeliveryMode.STORAGE,
      items: [
        {
          description: 'A',
          quantity: 1,
          unitPrice: 100,
          taxType: TurnkeyTaxType.TAXABLE,
          amount: null,
          unit: null,
          remark: null,
        },
      ],
      externalId: 'order-0007',
      buyer: null,
      issuedAt: '2026-10-20T10:03:12+08:00',
      carrier: { type: TurnkeyCarrierType.MOBILE, code: '/ABC+123', hiddenCode: null, typeCode: null },
      donation: null,
      printed: null,
      zeroRated: null,
      specialTaxRate: null,
      mainRemark: null,
      ...overrides,
    });

  it('maps nulls to undefined and parses issuedAt into a Date', () => {
    const result = toInvoiceIssueInput(input(), '12345675');

    expect(result.companyTaxId).toBe('12345675');
    expect(result.issuedAt).toEqual(new Date('2026-10-20T02:03:12.000Z'));
    expect(result.printed).toBeUndefined();
    expect(result.items[0].amount).toBeUndefined();
    expect(result.carrier).toEqual({
      type: TurnkeyCarrierType.MOBILE,
      code: '/ABC+123',
      hiddenCode: undefined,
      typeCode: undefined,
    });
  });

  it('rejects MIXED item tax types', () => {
    const mixed = input({
      items: [
        {
          description: 'A',
          quantity: 1,
          unitPrice: 100,
          taxType: TurnkeyTaxType.MIXED,
          amount: null,
          unit: null,
          remark: null,
        },
      ],
    });

    expect(() => toInvoiceIssueInput(mixed, '12345675')).toThrow(TurnkeyValidationError);
  });
});

describe('received document / invoice number / blank report mappers', () => {
  it('maps a received document without xml and keeps null fields as null', () => {
    const entity = {
      id: 'b1b2c3d4-0000-4000-8000-000000000002',
      buyerTaxId: '12345675',
      sellerTaxId: '00000001',
      messageType: TurnkeyMigMessageType.A0101,
      documentNumber: 'ZZ00000699',
      documentDate: '20261020',
      occurredAt: null,
      reason: null,
      status: TurnkeyReceivedDocumentStatus.RECEIVED,
      xml: '<Invoice/>',
      fileName: 'a.xml',
      createdAt,
      updatedAt: createdAt,
    } as TurnkeyReceivedDocumentEntity;

    const dto = toReceivedDocumentDto(entity);

    expect(dto).toEqual({
      id: entity.id,
      buyerTaxId: '12345675',
      sellerTaxId: '00000001',
      messageType: TurnkeyMigMessageType.A0101,
      documentNumber: 'ZZ00000699',
      documentDate: '20261020',
      occurredAt: null,
      reason: null,
      status: TurnkeyReceivedDocumentStatus.RECEIVED,
      fileName: 'a.xml',
      createdAt,
      updatedAt: createdAt,
    });

    expect(dto).not.toHaveProperty('xml');
  });

  it('maps an invoice number entry', () => {
    const dto = toInvoiceNumberDto({
      id: 'c1b2c3d4-0000-4000-8000-000000000003',
      companyTaxId: '12345675',
      period: '11510',
      invoiceNumber: 'ZZ00000601',
      status: TurnkeyNumberStatus.ABANDONED,
      updatedAt: createdAt,
    } as never);

    expect(dto).toEqual({
      id: 'c1b2c3d4-0000-4000-8000-000000000003',
      companyTaxId: '12345675',
      period: '11510',
      invoiceNumber: 'ZZ00000601',
      status: TurnkeyNumberStatus.ABANDONED,
      updatedAt: createdAt,
    });
  });

  it('maps blank number reports to begin/end ranges', () => {
    const dto = toBlankNumberReportDto({
      track: 'ZZ',
      submissionId: 'd1b2c3d4-0000-4000-8000-000000000004',
      ranges: [{ begin: '00000600', end: '00000602' }],
    });

    expect(dto).toEqual({
      id: 'd1b2c3d4-0000-4000-8000-000000000004',
      track: 'ZZ',
      submissionId: 'd1b2c3d4-0000-4000-8000-000000000004',
      ranges: [{ id: 'd1b2c3d4-0000-4000-8000-000000000004:00000600-00000602', begin: '00000600', end: '00000602' }],
    });
  });

  it('uses the tax ID as the company id', () => {
    const now = new Date('2026-10-22T00:00:00Z');

    expect(
      toCompanyDto({
        taxId: '12345675',
        name: '測試營業人',
        address: null,
        routingId: 'ROUTE-TEST',
        exchangeEnabled: false,
        certificateExpiresAt: null,
        qrAesKeyConfigured: false,
        createdAt: now,
        updatedAt: now,
      }),
    ).toMatchObject({ id: '12345675', taxId: '12345675' });
  });
});
