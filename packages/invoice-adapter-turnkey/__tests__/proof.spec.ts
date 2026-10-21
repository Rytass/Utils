/**
 * @jest-environment node
 */

import axios from 'axios';
import { TurnkeyInvoiceError, TurnkeyInvoiceGateway } from '../src';
import { allowanceProofResponse, BASE_URL, COMPANY_URL, httpError, invoiceProofResponse, okResponse } from './helpers';

describe('TurnkeyInvoiceGateway proof', () => {
  const post = jest.spyOn(axios, 'post');
  const gateway = new TurnkeyInvoiceGateway({ baseUrl: BASE_URL, companyTaxId: '12345675' });

  beforeEach(() => {
    post.mockReset();
  });

  afterAll(() => {
    post.mockRestore();
  });

  it('defaults to JSON and returns the raw proof object', async () => {
    post.mockResolvedValueOnce(okResponse(invoiceProofResponse(), 200));

    const proof = await gateway.getProof('AB12345678');

    expect(post).toHaveBeenCalledWith(
      `${COMPANY_URL}/invoices/AB12345678/proof`,
      { format: 'JSON' },
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }),
    );

    expect(post.mock.calls[0]?.[2]).not.toHaveProperty('responseType');
    expect(proof.documentType).toBe('INVOICE');
    expect(proof.barcode).toHaveLength(19);
    expect(proof.printCount).toBe(1);
    expect(proof.reprint).toBe(false);
    expect(proof.issuedAt).toBe('2026-10-21T10:00:00+08:00');
  });

  it('encodes the invoice number in the path', async () => {
    post.mockResolvedValueOnce(okResponse(invoiceProofResponse(), 200));

    await gateway.getProof('AB/1+2');

    expect(post).toHaveBeenCalledWith(
      `${COMPANY_URL}/invoices/AB%2F1%2B2/proof`,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it.each(['PDF', 'A4_PDF', 'PNG', 'ESC_POS'] as const)(
    'returns a Buffer for %s with arraybuffer responseType',
    async format => {
      const body = Buffer.from('%PDF-1.7 fake');

      post.mockResolvedValueOnce(okResponse(body, 200));

      const result = await gateway.getProof('AB12345678', format);

      expect(post).toHaveBeenCalledWith(
        `${COMPANY_URL}/invoices/AB12345678/proof`,
        { format },
        expect.objectContaining({
          headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
          responseType: 'arraybuffer',
        }),
      );

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(body);
    },
  );

  it('maps a 422 NOT_PRINTABLE returned as a binary body to TurnkeyInvoiceError with its code', async () => {
    post.mockRejectedValueOnce(
      httpError(422, Buffer.from(JSON.stringify({ code: 'NOT_PRINTABLE', message: '發票尚未開立，無法列印' }))),
    );

    await expect(gateway.getProof('AB12345678', 'PDF')).rejects.toMatchObject({
      name: 'TurnkeyInvoiceError',
      status: 422,
      code: 'NOT_PRINTABLE',
      message: '發票尚未開立，無法列印',
    });
  });

  it('decodes an ArrayBuffer error body with QR_KEY_MISSING', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ code: 'QR_KEY_MISSING', message: '缺少 QR 金鑰' }));

    post.mockRejectedValueOnce(httpError(422, bytes.buffer));

    const error = await gateway.getProof('AB12345678', 'PNG').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TurnkeyInvoiceError);
    expect(error).toMatchObject({ status: 422, code: 'QR_KEY_MISSING' });
  });

  it('maps 404 NOT_FOUND and 501 RENDERER_UNAVAILABLE for JSON and binary formats', async () => {
    post.mockRejectedValueOnce(httpError(404, { code: 'NOT_FOUND', message: '找不到發票' }));

    await expect(gateway.getProof('NOPE0000')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    post.mockRejectedValueOnce(httpError(501, Buffer.from(JSON.stringify({ code: 'RENDERER_UNAVAILABLE' }))));

    await expect(gateway.getProof('AB12345678', 'A4_PDF')).rejects.toMatchObject({
      status: 501,
      code: 'RENDERER_UNAVAILABLE',
    });
  });

  it('keeps the message for a 400 unknown format even when the body is not a Turnkey error code', async () => {
    post.mockRejectedValueOnce(httpError(400, { message: 'Unknown proof format', statusCode: 400 }));

    await expect(gateway.getProof('AB12345678', 'PDF')).rejects.toMatchObject({
      status: 400,
      message: 'Unknown proof format',
    });
  });

  it('fetches allowance proof through POST /allowances/{no}/proof for JSON and binary formats', async () => {
    post.mockResolvedValueOnce(okResponse(allowanceProofResponse(), 200));

    const proof = await gateway.getAllowanceProof('AL0000001');

    expect(post).toHaveBeenLastCalledWith(
      `${COMPANY_URL}/allowances/AL0000001/proof`,
      { format: 'JSON' },
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }),
    );

    expect(proof.documentType).toBe('ALLOWANCE');
    expect(proof.items[0]?.originalSequenceNumber).toBeNull();

    post.mockResolvedValueOnce(okResponse(Buffer.from('pdf'), 200));

    const binary = await gateway.getAllowanceProof('AL0000001', 'PDF');

    expect(post).toHaveBeenLastCalledWith(
      `${COMPANY_URL}/allowances/AL0000001/proof`,
      { format: 'PDF' },
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
        responseType: 'arraybuffer',
      }),
    );

    expect(Buffer.isBuffer(binary)).toBe(true);
  });

  it('sends the caller idempotency key and operator, or a fresh key per call', async () => {
    post.mockResolvedValue(okResponse(invoiceProofResponse(), 200));

    await gateway.getProof('AB12345678', 'JSON', { idempotencyKey: 'print-1', operator: 'cashier-7' });

    expect(post).toHaveBeenLastCalledWith(
      `${COMPANY_URL}/invoices/AB12345678/proof`,
      { format: 'JSON', operator: 'cashier-7' },
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': 'print-1' }) }),
    );

    await gateway.getProof('AB12345678');
    await gateway.getProof('AB12345678');

    const keys = post.mock.calls
      .slice(-2)
      .map(call => (call[2] as { headers: Record<string, string> }).headers['Idempotency-Key']);

    expect(keys[0]).not.toBe(keys[1]);
  });
});
