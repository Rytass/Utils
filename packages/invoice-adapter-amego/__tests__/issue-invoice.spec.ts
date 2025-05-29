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

    it('should issue with default options success', (done) => {
      invoiceGateway.issue({
        orderId: '3g49n0',
        buyerIdentifier: '55880710',
        carrier: {type: InvoiceCarrierType.MOBILE, code: '/DDPD7U2'},
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
          amount: 10,
          taxType: TaxType.TAXED,
        }],
        taxType: TaxType.TAXED,
        detailVat: true,
      }).then((invoice) => {
        expect(invoice.orderId).toBe('3g49n0');
        expect(invoice.issuedAmount).toBe(10);
        expect(invoice.invoiceNumber.length).toBe(10);
        expect(DateTime.fromJSDate(invoice.issuedOn).toFormat('yyyy-MM-dd HH:mm:ss')).toBe(DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'));

        done();
      });
    })

  });
});
