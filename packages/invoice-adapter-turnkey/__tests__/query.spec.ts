/**
 * @jest-environment node
 */

import axios from 'axios';
import {
  InvoiceAllowanceState,
  InvoiceState,
  TurnkeyInvoiceAllowance,
  TurnkeyInvoiceError,
  TurnkeyInvoiceGateway,
} from '../src';
import {
  allowanceResponse,
  BASE_URL,
  COMPANY_URL,
  httpError,
  invoiceAwareGet,
  invoiceResponse,
  okResponse,
} from './helpers';

describe('TurnkeyInvoiceGateway query', () => {
  const get = jest.spyOn(axios, 'get');
  const gateway = new TurnkeyInvoiceGateway({ baseUrl: BASE_URL, companyTaxId: '12345675' });

  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(invoiceAwareGet);
  });

  afterAll(() => {
    get.mockRestore();
  });

  it('queries by orderId through GET /invoices?externalId=', async () => {
    const invoice = await gateway.query({ orderId: 'ORDER-1' });

    expect(get).toHaveBeenCalledWith(
      `${COMPANY_URL}/invoices`,
      expect.objectContaining({ params: { externalId: 'ORDER-1' } }),
    );

    expect(invoice.invoiceNumber).toBe('AB12345678');
    expect(invoice.externalId).toBe('ORDER-1');
  });

  it('queries by invoiceNumber through GET /invoices/{invoiceNumber}', async () => {
    await gateway.query({ invoiceNumber: 'AB12345678' });

    expect(get).toHaveBeenCalledWith(`${COMPANY_URL}/invoices/AB12345678`, expect.any(Object));
  });

  it('maps VOIDED invoices to VOID with voidOn from voidedAt', async () => {
    get.mockResolvedValueOnce(
      okResponse(invoiceResponse({ status: 'VOIDED', voidedAt: '2026-10-22T08:00:00+08:00' }), 200),
    );

    const invoice = await gateway.query({ invoiceNumber: 'AB12345678' });

    expect(invoice.state).toBe(InvoiceState.VOID);
    expect(invoice.voidOn).toEqual(new Date('2026-10-22T08:00:00+08:00'));
    expect(invoice.turnkeyStatus).toBe('VOIDED');
  });

  it('maps item and invoice tax types back to @rytass/invoice TaxType', async () => {
    get.mockResolvedValueOnce(
      okResponse(
        invoiceResponse({
          taxType: 'MIXED',
          items: [{ sequenceNumber: 1, description: 'a', quantity: 1, unitPrice: 1, amount: 1, taxType: 'ZERO_RATED' }],
        }),
        200,
      ),
    );

    const invoice = await gateway.query({ orderId: 'ORDER-1' });

    expect(invoice.taxType).toBe('MIXED');
    expect(invoice.items).toEqual([{ name: 'a', quantity: 1, unitPrice: 1, taxType: 'ZERO_TAX' }]);
  });

  it('restores allowances from GET /invoices/{no}/allowances and recomputes nowAmount', async () => {
    get.mockResolvedValueOnce(okResponse(invoiceResponse(), 200));
    get.mockResolvedValueOnce(
      okResponse(
        [
          // 未稅 50 + 稅 2 = 含稅 52，扣減
          allowanceResponse({ allowanceNumber: 'AL1', totalAmount: 50, taxAmount: 2, status: 'ISSUED' }),
          // 已作廢：不扣減，保留 invalidOn
          allowanceResponse({
            allowanceNumber: 'AL2',
            totalAmount: 30,
            taxAmount: 1,
            status: 'VOIDED',
            voidedAt: '2026-10-23T10:00:00+08:00',
          }),
          // 未成立：不納入
          allowanceResponse({ allowanceNumber: null, totalAmount: 20, taxAmount: 1, status: 'FAILED' }),
          // 作廢待確認：仍扣減
          allowanceResponse({ allowanceNumber: 'AL4', totalAmount: 10, taxAmount: 0, status: 'VOID_PENDING' }),
        ],
        200,
      ),
    );

    const invoice = await gateway.query({ invoiceNumber: 'AB12345678' });

    expect(get).toHaveBeenLastCalledWith(`${COMPANY_URL}/invoices/AB12345678/allowances`, expect.any(Object));
    expect(invoice.allowances.map(allowance => allowance.allowanceNumber)).toEqual(['AL1', 'AL2', 'AL4']);
    expect(invoice.allowances[0]).toBeInstanceOf(TurnkeyInvoiceAllowance);
    expect(invoice.allowances[0]?.allowancePrice).toBe(52);
    expect(invoice.allowances[1]?.status).toBe(InvoiceAllowanceState.INVALID);
    expect(invoice.allowances[1]?.invalidOn).toEqual(new Date('2026-10-23T10:00:00+08:00'));
    expect(invoice.allowances[2]?.status).toBe(InvoiceAllowanceState.ISSUED);
    expect(invoice.nowAmount).toBe(105 - 52 - 10);
    expect(invoice.issuedAmount).toBe(105);
    expect(invoice.state).toBe(InvoiceState.ALLOWANCED);
  });

  it.each([
    ['SUBMITTED', InvoiceState.ISSUED],
    ['ISSUED', InvoiceState.ISSUED],
    ['CONFIRMED', InvoiceState.ISSUED],
    ['REJECTED', InvoiceState.ISSUED],
    ['VOID_PENDING', InvoiceState.VOID],
    ['VOIDED', InvoiceState.VOID],
    ['ANNULLED', InvoiceState.VOID],
    ['REJECTION_ACKNOWLEDGED', InvoiceState.VOID],
    ['FAILED', InvoiceState.INITED],
  ] as const)('maps Turnkey %s to InvoiceState %s and keeps the raw status', async (status, state) => {
    get.mockResolvedValueOnce(okResponse(invoiceResponse({ status }), 200));

    const invoice = await gateway.query({ orderId: 'ORDER-1' });

    expect(invoice.state).toBe(state);
    expect(invoice.turnkeyStatus).toBe(status);
  });

  it('does not fetch allowances when the invoice number is not assigned yet', async () => {
    get.mockResolvedValueOnce(okResponse(invoiceResponse({ invoiceNumber: null, status: 'FAILED' }), 200));

    const invoice = await gateway.query({ orderId: 'ORDER-1' });

    expect(get).toHaveBeenCalledTimes(1);
    expect(invoice.allowances).toHaveLength(0);
    expect(invoice.nowAmount).toBe(105);
  });

  it('throws TurnkeyInvoiceError when the invoice is not found (404)', async () => {
    get.mockRejectedValueOnce(httpError(404, { code: 'NOT_FOUND', message: 'invoice not found' }));

    await expect(gateway.query({ invoiceNumber: 'NOPE' })).rejects.toBeInstanceOf(TurnkeyInvoiceError);
  });
});
