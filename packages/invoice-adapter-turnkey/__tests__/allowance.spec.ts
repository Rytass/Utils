/**
 * @jest-environment node
 */

import axios from 'axios';
import {
  InvoiceAllowanceState,
  InvoiceState,
  TaxType,
  TurnkeyInvoice,
  TurnkeyInvoiceAllowance,
  TurnkeyInvoiceGateway,
} from '../src';
import { allowanceResponse, BASE_URL, COMPANY_URL, invoiceAwareGet, invoiceResponse, okResponse } from './helpers';

describe('TurnkeyInvoiceGateway allowance', () => {
  const post = jest.spyOn(axios, 'post');
  const get = jest.spyOn(axios, 'get');
  const gateway = new TurnkeyInvoiceGateway({ baseUrl: BASE_URL, companyTaxId: '12345675' });

  const loadInvoice = async (overrides: Parameters<typeof invoiceResponse>[0] = {}): Promise<TurnkeyInvoice> => {
    get.mockResolvedValueOnce(okResponse(invoiceResponse(overrides), 200));

    return gateway.query({ invoiceNumber: 'AB12345678' });
  };

  const allowanceItems = [{ name: '退貨', quantity: 1, unitPrice: 50, taxType: TaxType.TAXED }];

  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    get.mockImplementation(invoiceAwareGet);
  });

  afterAll(() => {
    post.mockRestore();
    get.mockRestore();
  });

  it('creates an allowance with items mapped to taxType and a content-hash Idempotency-Key', async () => {
    const invoice = await loadInvoice();

    post.mockResolvedValueOnce(okResponse(allowanceResponse({ totalAmount: 50, taxAmount: 2 })));

    const result = await gateway.allowance(invoice, allowanceItems);

    expect(post).toHaveBeenCalledWith(
      `${COMPANY_URL}/allowances`,
      {
        invoiceNumber: 'AB12345678',
        items: [{ description: '退貨', quantity: 1, unitPrice: 50, taxType: 'TAXABLE' }],
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(/^allowance:AB12345678:[0-9a-f]{64}$/),
        }),
      }),
    );

    expect(result).toBe(invoice);
    expect(invoice.allowances).toHaveLength(1);
    expect(invoice.allowances[0]).toBeInstanceOf(TurnkeyInvoiceAllowance);
    expect(invoice.allowances[0]?.allowanceNumber).toBe('AL0000001');
    expect(invoice.allowances[0]?.status).toBe(InvoiceAllowanceState.ISSUED);
    expect(invoice.nowAmount).toBe(105 - 52);
    expect(invoice.state).toBe(InvoiceState.ALLOWANCED);
  });

  it('does not attach a replayed allowance twice nor reduce nowAmount again', async () => {
    const invoice = await loadInvoice();

    // 相同內容 → 相同 Idempotency-Key → Turnkey 回放同一張折讓
    post.mockResolvedValue(okResponse(allowanceResponse({ totalAmount: 50, taxAmount: 2 })));

    await gateway.allowance(invoice, allowanceItems);
    await gateway.allowance(invoice, allowanceItems);

    const keys = post.mock.calls.map(
      call => (call[2] as { headers: Record<string, string> }).headers['Idempotency-Key'],
    );

    expect(keys[0]).toBe(keys[1]);
    expect(invoice.allowances).toHaveLength(1);
    expect(invoice.nowAmount).toBe(105 - 52);
  });

  it('uses a different key for different content and attaches the new allowance', async () => {
    const invoice = await loadInvoice();

    post.mockResolvedValueOnce(okResponse(allowanceResponse({ totalAmount: 50, taxAmount: 2 })));
    post.mockResolvedValueOnce(
      okResponse(allowanceResponse({ allowanceNumber: 'AL0000002', totalAmount: 40, taxAmount: 2 })),
    );

    await gateway.allowance(invoice, allowanceItems);
    await gateway.allowance(invoice, [{ ...allowanceItems[0]!, quantity: 2 }]);

    const keys = post.mock.calls.map(
      call => (call[2] as { headers: Record<string, string> }).headers['Idempotency-Key'],
    );

    expect(keys[0]).not.toBe(keys[1]);
    expect(invoice.allowances.map(allowance => allowance.allowanceNumber)).toEqual(['AL0000001', 'AL0000002']);
    expect(invoice.nowAmount).toBe(105 - 52 - 42);
  });

  it('uses an explicit idempotencyKey when given, so identical allowances can be forced through', async () => {
    const invoice = await loadInvoice();

    post.mockResolvedValueOnce(okResponse(allowanceResponse({ totalAmount: 50, taxAmount: 2 })));
    post.mockResolvedValueOnce(
      okResponse(allowanceResponse({ allowanceNumber: 'AL0000002', totalAmount: 50, taxAmount: 2 })),
    );

    await gateway.allowance(invoice, allowanceItems, { idempotencyKey: 'refund-1' });
    await gateway.allowance(invoice, allowanceItems, { idempotencyKey: 'refund-2' });

    expect(post.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': 'refund-1' }) }),
    );

    expect(post.mock.calls[1]?.[2]).toEqual(
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': 'refund-2' }) }),
    );

    expect(invoice.allowances).toHaveLength(2);
    expect(invoice.nowAmount).toBe(105 - 52 - 52);
  });

  it('requires a tax type for MIXED invoices and uses the explicit one when given', async () => {
    const invoice = await loadInvoice({ taxType: 'MIXED' });

    await expect(gateway.allowance(invoice, allowanceItems)).rejects.toThrow(
      'Mixed invoice allowance must specify a tax type',
    );

    expect(post).not.toHaveBeenCalled();

    post.mockResolvedValueOnce(okResponse(allowanceResponse()));

    await gateway.allowance(invoice, [{ name: '免稅', quantity: 1, unitPrice: 10 }], { taxType: TaxType.TAX_FREE });

    expect(post.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ items: [expect.objectContaining({ taxType: 'TAX_FREE' })] }),
    );
  });

  it('passes originalSequenceNumber through and keeps item taxType when given', async () => {
    const invoice = await loadInvoice();

    post.mockResolvedValueOnce(okResponse(allowanceResponse()));

    await gateway.allowance(invoice, [
      { name: '退貨', quantity: 1, unitPrice: 50, taxType: TaxType.ZERO_TAX, originalSequenceNumber: 3 },
    ]);

    expect(post.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        items: [{ originalSequenceNumber: 3, description: '退貨', quantity: 1, unitPrice: 50, taxType: 'ZERO_RATED' }],
      }),
    );
  });

  it('does not attach a FAILED allowance to the invoice', async () => {
    const invoice = await loadInvoice();

    post.mockResolvedValueOnce(okResponse(allowanceResponse({ status: 'FAILED' })));

    await expect(gateway.allowance(invoice, allowanceItems)).rejects.toThrow('Turnkey allowance failed');
    expect(invoice.allowances).toHaveLength(0);
    expect(invoice.nowAmount).toBe(105);
  });

  it('invalidates an allowance on VOIDED and restores the invoice remaining amount', async () => {
    const invoice = await loadInvoice();

    post.mockResolvedValueOnce(okResponse(allowanceResponse()));
    await gateway.allowance(invoice, allowanceItems);

    const allowance = invoice.allowances[0] as TurnkeyInvoiceAllowance;

    expect(invoice.nowAmount).toBe(0);

    post.mockResolvedValueOnce(okResponse(allowanceResponse({ status: 'VOIDED' })));

    const parent = await gateway.invalidAllowance(allowance);

    expect(post).toHaveBeenLastCalledWith(
      `${COMPANY_URL}/allowances/AL0000001/void`,
      { reason: '作廢折讓' },
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'void-allowance:AL0000001' }),
      }),
    );

    expect(parent).toBe(invoice);
    expect(allowance.status).toBe(InvoiceAllowanceState.INVALID);
    expect(invoice.nowAmount).toBe(105);
    expect(invoice.state).toBe(InvoiceState.ISSUED);
  });

  it('keeps the allowance ISSUED while VOID_PENDING and accepts a custom reason', async () => {
    const invoice = await loadInvoice();

    post.mockResolvedValueOnce(okResponse(allowanceResponse()));
    await gateway.allowance(invoice, allowanceItems);

    const allowance = invoice.allowances[0] as TurnkeyInvoiceAllowance;

    post.mockResolvedValueOnce(okResponse(allowanceResponse({ status: 'VOID_PENDING' })));

    await gateway.invalidAllowance(allowance, '客戶取消');

    expect(post.mock.calls[1]?.[1]).toEqual({ reason: '客戶取消' });
    expect(allowance.status).toBe(InvoiceAllowanceState.ISSUED);
    expect(allowance.turnkeyStatus).toBe('VOID_PENDING');
    expect(invoice.nowAmount).toBe(0);
    expect(invoice.state).toBe(InvoiceState.ALLOWANCED);
  });

  it('fetches an allowance through GET /allowances/{allowanceNumber}', async () => {
    get.mockResolvedValueOnce(okResponse(allowanceResponse(), 200));

    const response = await gateway.queryAllowance('AL0000001');

    expect(get).toHaveBeenCalledWith(`${COMPANY_URL}/allowances/AL0000001`, expect.any(Object));
    expect(response.allowanceNumber).toBe('AL0000001');
  });
});
