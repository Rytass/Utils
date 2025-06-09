/**
 * @jest-environment node
 */
import { AmegoInvoice, AmegoInvoiceGateway, InvoiceCarriers, InvoiceCarrierType, InvoiceState, SpecialTaxCode, TaxType } from '../src';

describe('AmegoInvoiceGateway Void Invoice', () => {
  describe('void invoice with default options', () => {

    const invoiceGateway = new AmegoInvoiceGateway();

    it('should void with default options success', (done) => {

      const voidInvoice = new AmegoInvoice({
        orderId: '3g49n0',
        invoiceNumber: 'AC12346555',
        items: [{
          quantity: 1,
          unitPrice: 10,
          taxType: TaxType.TAXED,
          name: '橡皮擦',
        }],
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-05-28T11:28:10.000Z'),
        allowances: [],
        randomCode: '2014',
        state: InvoiceState.VOID,
        voidOn: new Date(),
      })

      invoiceGateway.void(voidInvoice).then((invoice) => {
        expect(invoice.orderId).toBe('3g49n0');
        done();
      });
    })
  });
});
