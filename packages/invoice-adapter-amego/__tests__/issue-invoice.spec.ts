/**
 * @jest-environment node
 */
import { DateTime } from 'luxon';
import { AmegoInvoiceGateway, InvoiceCarriers, InvoiceCarrierType, SpecialTaxCode, TaxType } from '../src';

const DEFAULT_VAT_NUMBER = '12345678';
const DEFAULT_APP_KEY = 'sHeq7t8G1wiQvhAuIM27';

describe('AmegoInvoiceGateway Issue Invoice', () => {
  describe('issue invoice with default options', () => {

    const invoiceGateway = new AmegoInvoiceGateway();

    it('should issue with default options success', async () => {
      const invoice = await invoiceGateway.issue({
        orderId: '3g49n3',
        vatNumber: '55880710',
        buyerEmail: '',
        // carrier: { type: InvoiceCarrierType.MOBILE, code: '/DDPD7U2' },
        items: [{
          name: '口香糖',
          quantity: 10,
          unitPrice: 10,
          taxType: TaxType.TAXED,
        }, {
          name: '巧克力',
          quantity: 10,
          unitPrice: 15,
          taxType: TaxType.TAXED,
        }],
        taxType: TaxType.TAXED,
        detailVat: true,
      });

      expect(invoice.orderId).toBe('3g49n3');
      expect(invoice.issuedAmount).toBe(250);
      expect(invoice.invoiceNumber.length).toBe(10);

    });
  })
});
