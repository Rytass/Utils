/**
 * @jest-environment node
 */

import { AmegoBaseUrls, AmegoInvoiceGateway, } from '../src';

const DEFAULT_VAT_NUMBER = '12345678';
const DEFAULT_APP_KEY = 'sHeq7t8G1wiQvhAuIM27';

describe('Amego Invoice Barcode validation', () => {
  const gateway = new AmegoInvoiceGateway({
    vatNumber: DEFAULT_VAT_NUMBER,
    appKey: DEFAULT_APP_KEY,
    baseUrl: AmegoBaseUrls.DEVELOPMENT,
  });

  it('should query invoice valid barcode ', async () => {
    const validBarcode = await gateway.isMobileBarcodeValid('/4ALH+JQ');
    expect(validBarcode).toBe(true);
  });

  it('should query invoice invalid barcode ', async () => {
    const validBarcode = await gateway.isMobileBarcodeValid('/4ALH+JA');
    expect(validBarcode).toBe(false);
  });

});
