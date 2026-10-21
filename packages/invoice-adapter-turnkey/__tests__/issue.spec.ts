/**
 * @jest-environment node
 */

import axios from 'axios';
import {
  CustomsMark,
  InvoiceCarriers,
  InvoiceCarrierType,
  InvoiceState,
  TaxType,
  TurnkeyInvoiceError,
  TurnkeyInvoiceGateway,
  TurnkeyInvoiceIssueOptions,
} from '../src';
import { BASE_URL, COMPANY_URL, httpError, invoiceResponse, okResponse } from './helpers';

const VALID_VAT = '04595257';

const baseOptions = (overrides: Partial<TurnkeyInvoiceIssueOptions> = {}): TurnkeyInvoiceIssueOptions => ({
  orderId: 'ORDER-1',
  items: [{ name: '商品', quantity: 2, unitPrice: 50, unit: '個', taxType: TaxType.TAXED }],
  ...overrides,
});

describe('TurnkeyInvoiceGateway issue', () => {
  const post = jest.spyOn(axios, 'post');
  const gateway = new TurnkeyInvoiceGateway({
    baseUrl: BASE_URL,
    companyTaxId: '12345675',
    headers: { Authorization: 'Bearer token' },
    timeoutMs: 5000,
  });

  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue(okResponse(invoiceResponse()));
  });

  afterAll(() => {
    post.mockRestore();
  });

  it('maps a B2C print invoice with defaults and sends Idempotency-Key, auth header and timeout', async () => {
    const invoice = await gateway.issue(baseOptions({ carrier: InvoiceCarriers.PRINT }));

    expect(post).toHaveBeenCalledWith(
      `${COMPANY_URL}/invoices`,
      {
        deliveryMode: 'STORAGE',
        externalId: 'ORDER-1',
        items: [{ description: '商品', quantity: 2, unitPrice: 50, taxType: 'TAXABLE', unit: '個' }],
        printed: true,
      },
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'ORDER-1', Authorization: 'Bearer token' }),
        timeout: 5000,
      }),
    );

    expect(invoice.invoiceNumber).toBe('AB12345678');
    expect(invoice.randomCode).toBe('1234');
    expect(invoice.state).toBe(InvoiceState.ISSUED);
    expect(invoice.turnkeyStatus).toBe('ISSUED');
    expect(invoice.externalId).toBe('ORDER-1');
    expect(invoice.issuedAmount).toBe(105);
    expect(invoice.nowAmount).toBe(105);
  });

  it('passes unit prices through unchanged for B2B and sends buyer.taxId from vatNumber', async () => {
    await gateway.issue(
      baseOptions({
        vatNumber: VALID_VAT,
        buyer: { name: 'Acme', address: '台北市' },
        carrier: InvoiceCarriers.PRINT,
        remark: '備註',
        issuedAt: new Date('2026-10-21T02:00:00.000Z'),
      }),
    );

    expect(post.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        buyer: { taxId: VALID_VAT, name: 'Acme', address: '台北市' },
        items: [expect.objectContaining({ unitPrice: 50 })],
        issuedAt: '2026-10-21T02:00:00.000Z',
        mainRemark: '備註',
        printed: true,
      }),
    );
  });

  it('omits buyer and carrier fields for a plain B2C invoice without carrier', async () => {
    await gateway.issue(baseOptions());

    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;

    expect(body).not.toHaveProperty('buyer');
    expect(body).not.toHaveProperty('carrier');
    expect(body).not.toHaveProperty('donation');
    expect(body).not.toHaveProperty('printed');
  });

  it.each([
    [InvoiceCarriers.MOBILE('/ABC+123'), { carrier: { type: 'MOBILE', code: '/ABC+123' } }],
    [InvoiceCarriers.MOICA('AB12345678901234'), { carrier: { type: 'MOICA', code: 'AB12345678901234' } }],
    [
      { type: InvoiceCarrierType.MEMBER, code: 'member-1', typeCode: 'ABC123' },
      { carrier: { type: 'MEMBER', code: 'member-1', typeCode: 'ABC123' } },
    ],
    [
      { type: InvoiceCarrierType.PLATFORM, code: 'platform-1', typeCode: 'DEF456' },
      { carrier: { type: 'PLATFORM', code: 'platform-1', typeCode: 'DEF456' } },
    ],
    [{ type: InvoiceCarrierType.LOVE_CODE, code: '919' }, { donation: { npoCode: '919' } }],
  ])('maps carrier %j', async (carrier, expected) => {
    await gateway.issue(baseOptions({ carrier }));

    expect(post.mock.calls[0]?.[1]).toEqual(expect.objectContaining(expected));
  });

  it('rejects a PLATFORM carrier without typeCode before calling the API', async () => {
    await expect(
      gateway.issue(baseOptions({ carrier: { type: InvoiceCarrierType.PLATFORM, code: 'platform-1' } })),
    ).rejects.toThrow('carrier typeCode is required for PLATFORM');

    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a MEMBER carrier without code before calling the API', async () => {
    await expect(gateway.issue(baseOptions({ carrier: InvoiceCarriers.MEMBER }))).rejects.toThrow(
      'carrier code is required for MEMBER',
    );

    expect(post).not.toHaveBeenCalled();
  });

  it('sends zeroRated with reason code and customs clearance for ZERO_TAX items', async () => {
    await gateway.issue(
      baseOptions({
        items: [{ name: '出口品', quantity: 1, unitPrice: 100, taxType: TaxType.ZERO_TAX }],
        zeroRatedReasonCode: '71',
        customsMark: CustomsMark.YES,
      }),
    );

    expect(post.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ taxType: 'ZERO_RATED' })],
        zeroRated: { reasonCode: '71', customsClearance: 'VIA_CUSTOMS' },
      }),
    );
  });

  it('defaults customsClearance to NOT_VIA_CUSTOMS for zero-rated items', async () => {
    await gateway.issue(
      baseOptions({
        items: [{ name: '出口品', quantity: 1, unitPrice: 100, taxType: TaxType.ZERO_TAX }],
        zeroRatedReasonCode: '72',
      }),
    );

    expect(post.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ zeroRated: { reasonCode: '72', customsClearance: 'NOT_VIA_CUSTOMS' } }),
    );
  });

  it('rejects ZERO_TAX items without zeroRatedReasonCode', async () => {
    await expect(
      gateway.issue(baseOptions({ items: [{ name: 'x', quantity: 1, unitPrice: 1, taxType: TaxType.ZERO_TAX }] })),
    ).rejects.toThrow('`zeroRatedReasonCode` is required');

    expect(post).not.toHaveBeenCalled();
  });

  it('sends specialTaxRate for SPECIAL items and rejects when it is missing', async () => {
    await gateway.issue(
      baseOptions({
        items: [{ name: '特種', quantity: 1, unitPrice: 10, taxType: TaxType.SPECIAL }],
        specialTaxRate: 0.02,
      }),
    );

    expect(post.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ items: [expect.objectContaining({ taxType: 'SPECIAL' })], specialTaxRate: 0.02 }),
    );

    await expect(
      gateway.issue(baseOptions({ items: [{ name: '特種', quantity: 1, unitPrice: 10, taxType: TaxType.SPECIAL }] })),
    ).rejects.toThrow('`specialTaxRate` is required');
  });

  it('rejects an invalid VAT number before calling the API', async () => {
    await expect(gateway.issue(baseOptions({ vatNumber: '12345678' }))).rejects.toThrow('Invalid VAT number format');

    expect(post).not.toHaveBeenCalled();
  });

  it('maps SUBMITTED to ISSUED while keeping the raw status, and FAILED to INITED', async () => {
    post.mockResolvedValueOnce(okResponse(invoiceResponse({ status: 'SUBMITTED', invoiceNumber: null })));

    const submitted = await gateway.issue(baseOptions());

    expect(submitted.state).toBe(InvoiceState.ISSUED);
    expect(submitted.turnkeyStatus).toBe('SUBMITTED');
    expect(submitted.invoiceNumber).toBe('');

    post.mockResolvedValueOnce(okResponse(invoiceResponse({ status: 'FAILED' })));

    const failed = await gateway.issue(baseOptions());

    expect(failed.state).toBe(InvoiceState.INITED);
    expect(failed.turnkeyStatus).toBe('FAILED');
  });

  it('maps 422 validation errors to TurnkeyInvoiceError with issues', async () => {
    const issues = [{ code: 'REQUIRED', message: 'items is required', field: 'items' }];

    post.mockRejectedValueOnce(httpError(422, { code: 'VALIDATION_FAILED', message: '資料驗證失敗', issues }));

    const error = await gateway.issue(baseOptions()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TurnkeyInvoiceError);
    expect(error).toMatchObject({ status: 422, code: 'VALIDATION_FAILED', message: '資料驗證失敗', issues });
  });

  it('maps 409 EXTERNAL_ID_CONFLICT to TurnkeyInvoiceError with its code and message', async () => {
    post.mockRejectedValueOnce(
      httpError(409, { code: 'EXTERNAL_ID_CONFLICT', message: '此 externalId 已開立內容不同的發票' }),
    );

    await expect(gateway.issue(baseOptions())).rejects.toMatchObject({
      name: 'TurnkeyInvoiceError',
      status: 409,
      code: 'EXTERNAL_ID_CONFLICT',
      message: '此 externalId 已開立內容不同的發票',
    });
  });

  it('maps 409 IDEMPOTENCY_KEY_REUSED and 403 to TurnkeyInvoiceError', async () => {
    post.mockRejectedValueOnce(httpError(409, { code: 'IDEMPOTENCY_KEY_REUSED' }));

    await expect(gateway.issue(baseOptions())).rejects.toMatchObject({
      name: 'TurnkeyInvoiceError',
      status: 409,
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'Turnkey request failed with status 409',
    });

    post.mockRejectedValueOnce(httpError(403, { message: 'forbidden' }));

    await expect(gateway.issue(baseOptions())).rejects.toMatchObject({ status: 403, message: 'forbidden' });
  });

  it('rethrows non-HTTP failures such as network errors as plain errors', async () => {
    post.mockRejectedValueOnce(new Error('socket hang up'));

    const error = await gateway.issue(baseOptions()).catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(TurnkeyInvoiceError);
    expect(error).toEqual(new Error('socket hang up'));
  });
});
