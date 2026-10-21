/**
 * @jest-environment node
 */

import axios from 'axios';
import { InvoiceState, TurnkeyInvoice, TurnkeyInvoiceGateway } from '../src';
import { BASE_URL, COMPANY_URL, invoiceAwareGet, invoiceResponse, okResponse } from './helpers';

describe('TurnkeyInvoiceGateway void', () => {
  const post = jest.spyOn(axios, 'post');
  const get = jest.spyOn(axios, 'get');
  const gateway = new TurnkeyInvoiceGateway({ baseUrl: BASE_URL, companyTaxId: '12345675' });

  const loadInvoice = async (): Promise<TurnkeyInvoice> => {
    get.mockResolvedValueOnce(okResponse(invoiceResponse(), 200));

    return gateway.query({ invoiceNumber: 'AB12345678' });
  };

  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    get.mockImplementation(invoiceAwareGet);
  });

  afterAll(() => {
    post.mockRestore();
    get.mockRestore();
  });

  it('posts to /invoices/{n}/void with reason and void:<n> Idempotency-Key', async () => {
    const invoice = await loadInvoice();

    post.mockResolvedValueOnce(
      okResponse(invoiceResponse({ status: 'VOIDED', voidedAt: '2026-10-22T08:00:00+08:00' })),
    );

    const voided = await gateway.void(invoice, { reason: '打錯金額' });

    expect(post).toHaveBeenCalledWith(
      `${COMPANY_URL}/invoices/AB12345678/void`,
      { reason: '打錯金額' },
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': 'void:AB12345678' }) }),
    );

    expect(voided).toBe(invoice);
    expect(voided.state).toBe(InvoiceState.VOID);
    expect(voided.voidOn).toEqual(new Date('2026-10-22T08:00:00+08:00'));
    expect(voided.turnkeyStatus).toBe('VOIDED');
  });

  it('maps VOID_PENDING to VOID with voidOn from voidedAt (exchange mode awaiting buyer confirmation)', async () => {
    const invoice = await loadInvoice();

    post.mockResolvedValueOnce(
      okResponse(invoiceResponse({ status: 'VOID_PENDING', voidedAt: '2026-10-22T08:00:00+08:00' })),
    );

    const result = await gateway.void(invoice, { reason: '退貨' });

    expect(result.state).toBe(InvoiceState.VOID);
    expect(result.voidOn).toEqual(new Date('2026-10-22T08:00:00+08:00'));
    expect(result.turnkeyStatus).toBe('VOID_PENDING');
  });
});
