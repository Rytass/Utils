/**
 * @jest-environment node
 */

import axios, { AxiosResponse } from 'axios';
import { TurnkeyInvoice, TurnkeyInvoiceGateway, TurnkeySubmissionResponse } from '../src';
import { BASE_URL, COMPANY_URL, allowanceResponse, invoiceAwareGet, invoiceResponse, okResponse } from './helpers';

const submission = (overrides: Partial<TurnkeySubmissionResponse> = {}): TurnkeySubmissionResponse => ({
  id: '0b6f3c3e-8a51-4e6c-9a39-1c2d3e4f5a6b',
  messageType: 'F0401',
  documentNumber: 'AB12345678',
  status: 'REJECTED',
  resultCode: 'E1002',
  resultMessage: '買方未設定交換',
  previousSubmissionId: null,
  createdAt: '2026-10-21T10:00:00+08:00',
  ...overrides,
});

describe('TurnkeyInvoiceGateway retry', () => {
  const post = jest.spyOn(axios, 'post');
  const get = jest.spyOn(axios, 'get');
  const gateway = new TurnkeyInvoiceGateway({ baseUrl: BASE_URL, companyTaxId: '12345675' });

  const routeGet =
    (submissions: TurnkeySubmissionResponse[]) =>
    (url: string): Promise<AxiosResponse> =>
      url.endsWith('/submissions') ? Promise.resolve(okResponse(submissions, 200)) : invoiceAwareGet(url);

  const loadInvoice = async (): Promise<TurnkeyInvoice> => {
    get.mockResolvedValueOnce(okResponse(invoiceResponse({ status: 'REJECTED' }), 200));

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

  it('retries the latest rejected submission with retry:<id> key and reloads the invoice', async () => {
    const invoice = await loadInvoice();

    get.mockImplementation(routeGet([submission()]));
    post.mockResolvedValueOnce(okResponse(submission({ id: 'next', status: 'PENDING', previousSubmissionId: 'x' })));

    const reloaded = await gateway.retry(invoice);

    expect(get).toHaveBeenCalledWith(
      `${COMPANY_URL}/submissions`,
      expect.objectContaining({ params: { documentNumber: 'AB12345678', limit: '1' } }),
    );

    expect(post).toHaveBeenCalledWith(
      `${COMPANY_URL}/submissions/0b6f3c3e-8a51-4e6c-9a39-1c2d3e4f5a6b/retry`,
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'retry:0b6f3c3e-8a51-4e6c-9a39-1c2d3e4f5a6b' }),
      }),
    );

    expect(reloaded.invoiceNumber).toBe('AB12345678');
    expect(reloaded.turnkeyStatus).toBe('ISSUED');
  });

  it('retries a FAILED submission', async () => {
    const invoice = await loadInvoice();

    get.mockImplementation(routeGet([submission({ status: 'FAILED', resultCode: 'E0145' })]));
    post.mockResolvedValueOnce(okResponse(submission({ status: 'PENDING' })));

    await gateway.retry(invoice);

    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each(['PENDING', 'WRITTEN', 'ACCEPTED'] as const)('throws NOTHING_TO_RETRY when latest is %s', async status => {
    const invoice = await loadInvoice();

    get.mockImplementation(routeGet([submission({ status })]));

    await expect(gateway.retry(invoice)).rejects.toMatchObject({ code: 'NOTHING_TO_RETRY', status: 409 });
    expect(post).not.toHaveBeenCalled();
  });

  it('throws NOTHING_TO_RETRY when the document has no submission', async () => {
    const invoice = await loadInvoice();

    get.mockImplementation(routeGet([]));

    await expect(gateway.retry(invoice)).rejects.toMatchObject({ code: 'NOTHING_TO_RETRY' });
    expect(post).not.toHaveBeenCalled();
  });

  it('throws NOTHING_TO_RETRY without calling the API when the invoice has no number', async () => {
    get.mockResolvedValueOnce(okResponse(invoiceResponse({ invoiceNumber: null, status: 'FAILED' }), 200));

    const invoice = await gateway.query({ orderId: 'ORDER-1' });

    get.mockClear();

    await expect(gateway.retry(invoice)).rejects.toMatchObject({ code: 'NOTHING_TO_RETRY' });
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('retryAllowance retries by allowance number and reloads the parent invoice', async () => {
    get.mockImplementation((url: string) =>
      url.endsWith('/allowances')
        ? Promise.resolve(okResponse([allowanceResponse()], 200))
        : url.endsWith('/submissions')
          ? Promise.resolve(
              okResponse([submission({ messageType: 'G0401', documentNumber: 'AL0000001', status: 'REJECTED' })], 200),
            )
          : Promise.resolve(okResponse(invoiceResponse(), 200)),
    );

    const invoice = await gateway.query({ invoiceNumber: 'AB12345678' });
    const [allowance] = invoice.allowances;

    post.mockResolvedValueOnce(okResponse(submission({ status: 'PENDING' })));

    const reloaded = await gateway.retryAllowance(allowance);

    expect(get).toHaveBeenCalledWith(
      `${COMPANY_URL}/submissions`,
      expect.objectContaining({ params: { documentNumber: 'AL0000001', limit: '1' } }),
    );

    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/submissions\/.+\/retry$/), undefined, expect.anything());

    expect(reloaded.invoiceNumber).toBe('AB12345678');
  });
});
