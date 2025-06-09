/**
 * @jest-environment node
 */

import { AmegoInvoiceGateway, InvoiceAllowanceState, TaxType } from '../src';
import { DateTime } from 'luxon';
import { AmegoInvoice } from '../src/amego-invoice';
import { AmegoAllowance } from '../src/amego-allowance';

describe('AmegoInvoiceGateway:Allowance', () => {

  describe('should invoice allowance', () => {
    const invoiceGateway = new AmegoInvoiceGateway();

    it('should allowance an invoice', async () => {

      const invoice = await invoiceGateway.query({ orderId: '202506061426231983' });

      const data = await invoiceGateway.allowance(invoice, [{
        name: '巧克力',
        quantity: 2,
        unitPrice: 15,
        taxType: TaxType.TAXED,
      },
      {
        name: '口香糖',
        quantity: 2,
        unitPrice: 10,
        taxType: TaxType.TAXED,
      },
      ]);

      expect(data).toBeDefined();
      expect(data.invoiceNumber).toBe(invoice.invoiceNumber);
      expect(data.issuedAmount).toBe(250);
      expect(data.allowances.length).toBe(4);
      expect(data.allowances[0]).toBeInstanceOf(AmegoAllowance);
      expect(data.allowances[0].allowancePrice).toBe(30);
      expect(['D0401', 'G0401']).toContain(data.allowances[0].invoiceType);
      expect(data.allowances[0].status).toBe(InvoiceAllowanceState.ISSUED);
      expect(data.items.length).toBe(2);
      expect(data.items[0].name).toBe('巧克力');

    });

  });

  describe('should invalid invoice allowance', () => {
    const invoiceGateway = new AmegoInvoiceGateway();

    it('should allowance an invoice', async () => {

      const invoice = await invoiceGateway.query({ orderId: '202506061426231983' });

      const data = await invoiceGateway.invalidAllowance(invoice.allowances[0]);

      expect(data.allowances[0].status).toBe(InvoiceAllowanceState.INVALID);
    });

  });
});
