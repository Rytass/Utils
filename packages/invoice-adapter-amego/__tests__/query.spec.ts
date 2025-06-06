/**
 * @jest-environment node
 */
import { AmegoBaseUrls, AmegoInvoiceGateway } from '../src';

const DEFAULT_VAT_NUMBER = '12345678';
const DEFAULT_APP_KEY = 'sHeq7t8G1wiQvhAuIM27';

describe('Amego Invoice Query', () => {

  describe('check mobile barcode with default gateway options', () => {
    const invoiceGateway = new AmegoInvoiceGateway();

    it('should query invoice valid barcode ', async () => {
      const validBarcode = await invoiceGateway.isMobileBarcodeValid('/DDPD7U2');

      expect(validBarcode).toBe(true);
    });

    it('should query invoice invalid barcode ', async () => {
      const invalidBarcode = await invoiceGateway.isMobileBarcodeValid('/DDPD7U3');

      expect(invalidBarcode).toBe(false);
    });
  });

  describe('check mobile barcode with specific gateway options', () => {
    const invoiceGateway = new AmegoInvoiceGateway({
      appKey: DEFAULT_APP_KEY,
      vatNumber: DEFAULT_VAT_NUMBER,
      baseUrl: AmegoBaseUrls.DEVELOPMENT,
    });

    it('should query invoice valid barcode ', async () => {
      const validBarcode = await invoiceGateway.isMobileBarcodeValid('/DDPD7U2');

      expect(validBarcode).toBe(true);
    });

    it('should query invoice invalid barcode ', async () => {
      const invalidBarcode = await invoiceGateway.isMobileBarcodeValid('/DDPD7U3');

      expect(invalidBarcode).toBe(false);
    });
  });

  describe('query invoice with default gateway options', () => {
    const invoiceGateway = new AmegoInvoiceGateway({
      appKey: DEFAULT_APP_KEY,
      vatNumber: DEFAULT_VAT_NUMBER,
      baseUrl: AmegoBaseUrls.DEVELOPMENT,
    });

    it('should query invoice by orderId ', async () => {
      const data = await invoiceGateway.query({ orderId: '3g49n3' });

      console.log(`Query Result by orderId: ${JSON.stringify(data)}`);

      expect(data.orderId).toBe('3g49n3');
      expect(data.invoiceNumber).toBe('AC12364096');
    });

    it('should query invoice by invoiceNumber ', async () => {
      const data = await invoiceGateway.query({ invoiceNumber: 'AC12364090' });

      console.log(`Query Result by invoiceNumber: ${JSON.stringify(data)}`);
      expect(data.orderId).toBe('202506061426231983');
      expect(data.invoiceNumber).toBe('AC12364090');
    });
  });

});
