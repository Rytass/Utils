/**
 * @jest-environment node
 */

import axios from 'axios';
import { TurnkeyInvoiceGateway } from '../src';
import { BASE_URL, COMPANY_URL, okResponse } from './helpers';

describe('TurnkeyInvoiceGateway validation', () => {
  const get = jest.spyOn(axios, 'get');
  const gateway = new TurnkeyInvoiceGateway({ baseUrl: BASE_URL, companyTaxId: '12345675' });

  beforeEach(() => {
    get.mockReset();
  });

  afterAll(() => {
    get.mockRestore();
  });

  it('validates a mobile barcode and encodes "/" and "+" in the path', async () => {
    get.mockResolvedValueOnce(okResponse({ valid: true }, 200));

    await expect(gateway.isMobileBarcodeValid('/ABC+123')).resolves.toBe(true);
    expect(get).toHaveBeenCalledWith(`${COMPANY_URL}/validation/mobile-barcodes/%2FABC%2B123`, expect.any(Object));
  });

  it('returns false for an invalid mobile barcode', async () => {
    get.mockResolvedValueOnce(okResponse({ valid: false }, 200));

    await expect(gateway.isMobileBarcodeValid('/XXXXXXX')).resolves.toBe(false);
  });

  it('validates a love code through the npo-codes endpoint', async () => {
    get.mockResolvedValueOnce(okResponse({ valid: true }, 200));

    await expect(gateway.isLoveCodeValid('919')).resolves.toBe(true);
    expect(get).toHaveBeenCalledWith(`${COMPANY_URL}/validation/npo-codes/919`, expect.any(Object));
  });
});
