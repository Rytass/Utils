/**
 * @jest-environment node
 */

import {
  AmegoBaseUrls,
  AmegoInvoiceGateway,
  InvoiceAllowanceState,
  InvoiceState,
  TaxType,
} from '../src';
import { DateTime } from 'luxon';
import { AmegoInvoice } from '../src/amego-invoice';
import { AmegoAllowance } from '../src/amego-allowance';
import axios from 'axios';

const baseUrl = AmegoBaseUrls.DEVELOPMENT;

describe('AmegoInvoiceGateway:Allowance', () => {
  describe('should invoice allowance', () => {
    const post = jest.spyOn(axios, 'post');
    const invoiceGateway = new AmegoInvoiceGateway();

    beforeAll(() => {
      post.mockImplementation(async (url: string, data: any) => {
        if (url === `${baseUrl}/json/g0401`) {
          return {
            data: {
              code: 0,
              msg: '',
            },
          };
        }

        if (url === `${baseUrl}/json/invoice_query`) {
          return {
            data: {
              code: 0,
              msg: '',
              data: {
                invoice_number: 'AC12367705',
                invoice_type: 'C0401',
                invoice_status: 99,
                invoice_date: 20250609,
                invoice_time: '22:20:29',
                buyer_identifier: '55880710',
                buyer_name: '翔光製帽股份有限公司',
                sales_amount: 238,
                tax_type: 1,
                tax_rate: '0.05',
                tax_amount: 12,
                total_amount: 250,
                rand_number: '6121',
                order_id: '202506091426231986',
                detailVat: 1,
                create_date: 1749478829,
                allowance: [],
                product_item: [
                  {
                    description: '口香糖',
                    quantity: 10,
                    unit_price: 10,
                    tax_type: 1,
                    amount: 100,
                    unit: '',
                  },
                  {
                    description: '巧克力',
                    quantity: 10,
                    unit_price: 15,
                    tax_type: 1,
                    amount: 150,
                    unit: '',
                  },
                ],
              },
            },
          };
        }
      });
    });

    it('should allowance an invoice', async () => {
      const invoice = await invoiceGateway.query({
        orderId: '202506091426231986',
      });

      const data = await invoiceGateway.allowance(invoice, [
        {
          name: '口香糖',
          quantity: 2,
          unitPrice: 10,
          taxType: TaxType.TAXED,
        },
      ]);

      expect(data.invoiceNumber).toBe(invoice.invoiceNumber);
      expect(data.issuedAmount).toBe(250);
      expect(data.allowances.length).toBe(1);
      expect(data.allowances[0]).toBeInstanceOf(AmegoAllowance);
      expect(data.allowances[0].allowancePrice).toBe(20);
      expect(['D0401', 'G0401']).toContain(data.allowances[0].invoiceType);
      expect(data.allowances[0].status).toBe(InvoiceAllowanceState.ISSUED);
      expect(data.items.length).toBe(2);
      expect(data.items[0].name).toBe('口香糖');
    });
  });

  describe('should invalid invoice allowance', () => {
    const invoiceGateway = new AmegoInvoiceGateway();
    const post = jest.spyOn(axios, 'post');

    beforeAll(() => {
      post.mockImplementation(async (url: string, data: any) => {
        if (url === `${baseUrl}/json/g0501`) {
          return {
            data: {
              code: 0,
              msg: '',
            },
          };
        }

        if (url === `${baseUrl}/json/invoice_query`) {
          return {
            data: {
              code: 0,
              msg: '',
              data: {
                invoice_number: 'AC12364090',
                invoice_type: 'C0401',
                invoice_status: 99,
                invoice_date: 20250606,
                invoice_time: '14:26:23',
                buyer_identifier: '55880710',
                buyer_name: '翔光製帽股份有限公司',
                sales_amount: 238,
                tax_type: 1,
                tax_rate: '0.05',
                tax_amount: 12,
                total_amount: 250,
                rand_number: '5345',
                order_id: '202506061426231983',
                detailVat: 1,
                create_date: 1749191183,
                allowance: [
                  {
                    invoice_type: 'D0501',
                    invoice_status: 99,
                    allowance_type: 2,
                    allowance_number: 'AC12364090AL0001',
                    allowance_date: 20250606,
                    tax_amount: 1,
                    total_amount: 19,
                  },
                  {
                    invoice_type: 'D0401',
                    invoice_status: 99,
                    allowance_type: 2,
                    allowance_number: 'AC12364090AL0002',
                    allowance_date: 20250606,
                    tax_amount: 2,
                    total_amount: 58,
                  },
                  {
                    invoice_type: 'D0401',
                    invoice_status: 99,
                    allowance_type: 2,
                    allowance_number: 'AC12364090AL0003',
                    allowance_date: 20250606,
                    tax_amount: 2,
                    total_amount: 48,
                  },
                  {
                    invoice_type: 'D0401',
                    invoice_status: 99,
                    allowance_type: 2,
                    allowance_number: 'AC12364090AL0004',
                    allowance_date: 20250609,
                    tax_amount: 2,
                    total_amount: 48,
                  },
                  {
                    invoice_type: 'D0401',
                    invoice_status: 99,
                    allowance_type: 2,
                    allowance_number: 'AC12364090AL0005',
                    allowance_date: 20250609,
                    tax_amount: 2,
                    total_amount: 48,
                  },
                ],
                product_item: [
                  {
                    name: '口香糖',
                    quantity: 10,
                    unit_price: 10,
                    tax_type: 1,
                  },
                  {
                    name: '巧克力',
                    quantity: 10,
                    unit_price: 15,
                    tax_type: 1,
                  },
                ],
              },
            },
          };
        }
      });
    });

    it('should invalid invoice allowance ', async () => {
      const invoice = await invoiceGateway.query({
        orderId: '202506061426231983',
      });

      const data = await invoiceGateway.invalidAllowance(invoice.allowances[0]);

      // expect(data.allowances[0].status).toBe(InvoiceAllowanceState.INVALID);
    });
  });
});
