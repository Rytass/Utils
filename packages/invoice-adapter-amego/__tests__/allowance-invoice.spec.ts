/**
 * @jest-environment node
 */

import { AmegoBaseUrls, AmegoInvoiceGateway, InvoiceAllowanceState, InvoiceState, TaxType } from '../src';
import { AmegoInvoice } from '../src/amego-invoice';
import { AmegoAllowance } from '../src/amego-allowance';
import axios from 'axios';

const baseUrl = AmegoBaseUrls.DEVELOPMENT;

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AmegoInvoiceGateway:Allowance', () => {
  let invoiceGateway: AmegoInvoiceGateway;

  beforeEach(() => {
    invoiceGateway = new AmegoInvoiceGateway();
    jest.clearAllMocks();
  });

  describe('allowance operations', () => {
    it('should create allowance for an invoice', async () => {
      // Mock query response
      mockedAxios.post.mockImplementation(async (url: string, _data: any) => {
        if (url === `${baseUrl}/json/invoice_query`) {
          return {
            data: {
              code: 0,
              msg: '',
              data: {
                invoice_number: 'AC12367705',
                invoice_type: 'C0401',
                invoice_status: 99,
                invoice_date: '20250609',
                invoice_time: '22:20:29',
                buyer_identifier: '55880710',
                buyer_name: '翔光製帽股份有限公司',
                sales_amount: 238,
                tax_type: 1,
                tax_rate: '0.05',
                tax_amount: 12,
                total_amount: 250,
                random_number: '6121',
                order_id: '202506091426231986',
                detailVat: 1,
                create_date: 1749478829,
                carrier_type: '',
                carrier_id1: '',
                carrier_id2: '',
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

        if (url === `${baseUrl}/json/g0401`) {
          return {
            data: {
              code: 0,
              msg: '',
            },
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      const invoice = await invoiceGateway.query({
        orderId: '202506091426231986',
      });

      const result = await invoiceGateway.allowance(invoice, [
        {
          name: '口香糖',
          quantity: 2,
          unitPrice: 10,
          taxType: TaxType.TAXED,
        },
      ]);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseUrl}/json/g0401`,
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      expect(result.invoiceNumber).toBe(invoice.invoiceNumber);
      expect(result.issuedAmount).toBe(250);
      expect(result.allowances.length).toBe(1);
      expect(result.allowances[0]).toBeInstanceOf(AmegoAllowance);
      expect(result.allowances[0].allowancePrice).toBe(20);
      expect(['D0401', 'G0401']).toContain(result.allowances[0].invoiceType);
      expect(result.allowances[0].status).toBe(InvoiceAllowanceState.ISSUED);
      expect(result.items.length).toBe(2);
      expect(result.items[0].name).toBe('口香糖');
    });

    it('should create allowance for consumer invoice (vatNumber 0000000000)', async () => {
      // Mock query response for consumer invoice
      mockedAxios.post.mockImplementation(async (url: string, _data: any) => {
        if (url === `${baseUrl}/json/invoice_query`) {
          return {
            data: {
              code: 0,
              msg: '',
              data: {
                invoice_number: 'AC12367706',
                invoice_type: 'C0401',
                invoice_status: 99,
                invoice_date: '20250609',
                invoice_time: '22:20:29',
                buyer_identifier: '0000000000', // Consumer vatNumber
                buyer_name: '消費者',
                sales_amount: 95,
                tax_type: 1,
                tax_rate: '0.05',
                tax_amount: 5,
                total_amount: 100,
                random_number: '6122',
                order_id: '202506091426231987',
                detailVat: 1,
                create_date: 1749478829,
                carrier_type: '',
                carrier_id1: '',
                carrier_id2: '',
                allowance: [],
                product_item: [
                  {
                    description: '商品',
                    quantity: 1,
                    unit_price: 100,
                    tax_type: 1,
                    amount: 100,
                    unit: '',
                  },
                ],
              },
            },
          };
        }

        if (url === `${baseUrl}/json/g0401`) {
          return {
            data: {
              code: 0,
              msg: '',
            },
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      const invoice = await invoiceGateway.query({
        orderId: '202506091426231987',
      });

      const result = await invoiceGateway.allowance(invoice, [
        {
          name: '商品',
          unitPrice: 105.26, // 含稅價格
          quantity: 1,
          taxType: TaxType.TAXED,
        },
      ]);

      expect(result.invoiceNumber).toBe(invoice.invoiceNumber);
      expect(result.issuedAmount).toBe(100);
      expect(result.allowances.length).toBe(1);
      expect(result.allowances[0]).toBeInstanceOf(AmegoAllowance);
      expect(result.allowances[0].allowancePrice).toBe(105.26);
      expect(['D0401', 'G0401']).toContain(result.allowances[0].invoiceType);
      expect(result.allowances[0].status).toBe(InvoiceAllowanceState.ISSUED);
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('商品');
    });

    it('should handle allowance with multiple items', async () => {
      mockedAxios.post.mockImplementation(async (url: string, _data: any) => {
        if (url === `${baseUrl}/json/invoice_query`) {
          return {
            data: {
              code: 0,
              msg: '',
              data: {
                invoice_number: 'AC12367706',
                invoice_type: 'C0401',
                invoice_status: 99,
                invoice_date: '20250609',
                invoice_time: '22:20:29',
                buyer_identifier: '55880710',
                buyer_name: '翔光製帽股份有限公司',
                sales_amount: 238,
                tax_type: 1,
                tax_rate: '0.05',
                tax_amount: 12,
                total_amount: 250,
                random_number: '6121',
                order_id: '202506091426231987',
                detailVat: 1,
                create_date: 1749478829,
                carrier_type: '',
                carrier_id1: '',
                carrier_id2: '',
                allowance: [],
                product_item: [
                  {
                    description: '商品A',
                    quantity: 5,
                    unit_price: 20,
                    tax_type: 1,
                    amount: 100,
                    unit: '',
                  },
                  {
                    description: '商品B',
                    quantity: 3,
                    unit_price: 50,
                    tax_type: 1,
                    amount: 150,
                    unit: '',
                  },
                ],
              },
            },
          };
        }

        if (url === `${baseUrl}/json/g0401`) {
          return {
            data: {
              code: 0,
              msg: '',
            },
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      const invoice = await invoiceGateway.query({
        orderId: '202506091426231987',
      });

      const result = await invoiceGateway.allowance(invoice, [
        {
          name: '商品A',
          quantity: 1,
          unitPrice: 20,
          taxType: TaxType.TAXED,
        },
        {
          name: '商品B',
          quantity: 1,
          unitPrice: 50,
          taxType: TaxType.TAXED,
        },
      ]);

      expect(result.allowances.length).toBe(1);
      expect(result.allowances[0].allowancePrice).toBe(70);
    });

    it('should handle allowance with different tax types', async () => {
      mockedAxios.post.mockImplementation(async (url: string, _data: any) => {
        if (url === `${baseUrl}/json/invoice_query`) {
          return {
            data: {
              code: 0,
              msg: '',
              data: {
                invoice_number: 'AC12367707',
                invoice_type: 'C0401',
                invoice_status: 99,
                invoice_date: '20250609',
                invoice_time: '22:20:29',
                buyer_identifier: '55880710',
                buyer_name: '翔光製帽股份有限公司',
                sales_amount: 238,
                tax_type: 2,
                tax_rate: '0.00',
                tax_amount: 0,
                total_amount: 250,
                random_number: '6121',
                order_id: '202506091426231988',
                detailVat: 1,
                create_date: 1749478829,
                carrier_type: '',
                carrier_id1: '',
                carrier_id2: '',
                allowance: [],
                product_item: [
                  {
                    description: '零稅率商品',
                    quantity: 5,
                    unit_price: 50,
                    tax_type: 2,
                    amount: 250,
                    unit: '',
                  },
                ],
              },
            },
          };
        }

        if (url === `${baseUrl}/json/g0401`) {
          return {
            data: {
              code: 0,
              msg: '',
            },
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      const invoice = await invoiceGateway.query({
        orderId: '202506091426231988',
      });

      const result = await invoiceGateway.allowance(invoice, [
        {
          name: '零稅率商品',
          quantity: 1,
          unitPrice: 50,
          taxType: TaxType.ZERO_TAX,
        },
      ]);

      expect(result.allowances.length).toBe(1);
      expect(result.allowances[0].allowancePrice).toBe(50);
    });

    it('should handle allowance with custom allowance type', async () => {
      mockedAxios.post.mockImplementation(async (url: string, _data: any) => {
        if (url === `${baseUrl}/json/invoice_query`) {
          return {
            data: {
              code: 0,
              msg: '',
              data: {
                invoice_number: 'AC12367708',
                invoice_type: 'C0401',
                invoice_status: 99,
                invoice_date: '20250609',
                invoice_time: '22:20:29',
                buyer_identifier: '55880710',
                buyer_name: '翔光製帽股份有限公司',
                sales_amount: 238,
                tax_type: 1,
                tax_rate: '0.05',
                tax_amount: 12,
                total_amount: 250,
                random_number: '6121',
                order_id: '202506091426231989',
                detailVat: 1,
                create_date: 1749478829,
                carrier_type: '',
                carrier_id1: '',
                carrier_id2: '',
                allowance: [],
                product_item: [
                  {
                    description: '商品',
                    quantity: 1,
                    unit_price: 100,
                    tax_type: 1,
                    amount: 100,
                    unit: '',
                  },
                ],
              },
            },
          };
        }

        if (url === `${baseUrl}/json/g0401`) {
          return {
            data: {
              code: 0,
              msg: '',
            },
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      const invoice = await invoiceGateway.query({
        orderId: '202506091426231989',
      });

      const result = await invoiceGateway.allowance(invoice, [
        {
          name: '商品',
          quantity: 1,
          unitPrice: 50,
          taxType: TaxType.TAXED,
        },
      ]);

      expect(result.allowances.length).toBe(1);
      expect(result.allowances[0].allowancePrice).toBe(50);
    });
  });

  describe('allowance validation errors', () => {
    it('should throw error when invoice is not issued', async () => {
      const voidInvoice = new AmegoInvoice({
        orderId: 'test123',
        invoiceNumber: 'AC12367709',
        items: [
          {
            name: '商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
        taxType: TaxType.TAXED,
        issuedOn: new Date(),
        allowances: [],
        randomCode: '1234',
        state: InvoiceState.VOID,
        voidOn: new Date(),
      });

      await expect(
        invoiceGateway.allowance(voidInvoice, [
          {
            name: '商品',
            quantity: 1,
            unitPrice: 50,
            taxType: TaxType.TAXED,
          },
        ]),
      ).rejects.toThrow('Invoice is not issued');
    });

    it('should throw error when allowance quantity is zero or negative', async () => {
      const invoice = new AmegoInvoice({
        orderId: 'test123',
        invoiceNumber: 'AC12367710',
        items: [
          {
            name: '商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
        taxType: TaxType.TAXED,
        issuedOn: new Date(),
        allowances: [],
        randomCode: '1234',
        state: InvoiceState.ISSUED,
        voidOn: null,
      });

      await expect(
        invoiceGateway.allowance(invoice, [
          {
            name: '商品',
            quantity: 0,
            unitPrice: 10,
            taxType: TaxType.TAXED,
          },
        ]),
      ).rejects.toThrow('Item 0: quantity must be positive');
    });

    it('should throw error when allowance unit price is zero or negative', async () => {
      const invoice = new AmegoInvoice({
        orderId: 'test123',
        invoiceNumber: 'AC12367711',
        items: [
          {
            name: '商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
        taxType: TaxType.TAXED,
        issuedOn: new Date(),
        allowances: [],
        randomCode: '1234',
        state: InvoiceState.ISSUED,
        voidOn: null,
      });

      await expect(
        invoiceGateway.allowance(invoice, [
          {
            name: '商品',
            quantity: 1,
            unitPrice: 0,
            taxType: TaxType.TAXED,
          },
        ]),
      ).rejects.toThrow('Item 0: unitPrice must be positive');
    });

    it('should throw error when allowance items are empty', async () => {
      const invoice = new AmegoInvoice({
        orderId: 'test123',
        invoiceNumber: 'AC12367712',
        items: [
          {
            name: '商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
        taxType: TaxType.TAXED,
        issuedOn: new Date(),
        allowances: [],
        randomCode: '1234',
        state: InvoiceState.ISSUED,
        voidOn: null,
      });

      await expect(invoiceGateway.allowance(invoice, [])).rejects.toThrow('Allowance items cannot be empty');
    });
  });

  describe('allowance API errors', () => {
    it('should throw error when allowance API returns error code', async () => {
      mockedAxios.post.mockImplementation(async (url: string, _data: any) => {
        if (url === `${baseUrl}/json/invoice_query`) {
          return {
            data: {
              code: 0,
              msg: '',
              data: {
                invoice_number: 'AC12367711',
                invoice_type: 'C0401',
                invoice_status: 99,
                invoice_date: '20250609',
                invoice_time: '22:20:29',
                buyer_identifier: '55880710',
                buyer_name: '翔光製帽股份有限公司',
                sales_amount: 238,
                tax_type: 1,
                tax_rate: '0.05',
                tax_amount: 12,
                total_amount: 250,
                random_number: '6121',
                order_id: '202506091426231990',
                detailVat: 1,
                create_date: 1749478829,
                carrier_type: '',
                carrier_id1: '',
                carrier_id2: '',
                allowance: [],
                product_item: [
                  {
                    description: '商品',
                    quantity: 1,
                    unit_price: 100,
                    tax_type: 1,
                    amount: 100,
                    unit: '',
                  },
                ],
              },
            },
          };
        }

        if (url === `${baseUrl}/json/g0401`) {
          return {
            data: {
              code: 1001,
              msg: 'Allowance creation failed',
            },
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      const invoice = await invoiceGateway.query({
        orderId: '202506091426231990',
      });

      await expect(
        invoiceGateway.allowance(invoice, [
          {
            name: '商品',
            quantity: 1,
            unitPrice: 50,
            taxType: TaxType.TAXED,
          },
        ]),
      ).rejects.toThrow('Failed to allowance invoice');
    });
  });

  describe('invalidAllowance operations', () => {
    it('should invalid allowance successfully', async () => {
      // Mock query response with allowances
      mockedAxios.post.mockImplementation(async (url: string, _data: any) => {
        if (url === `${baseUrl}/json/invoice_query`) {
          return {
            data: {
              code: 0,
              msg: '',
              data: {
                invoice_number: 'AC12364090',
                invoice_type: 'C0401',
                invoice_status: 99,
                invoice_date: '20250606',
                invoice_time: '14:26:23',
                buyer_identifier: '55880710',
                buyer_name: '翔光製帽股份有限公司',
                sales_amount: 238,
                tax_type: 1,
                tax_rate: '0.05',
                tax_amount: 12,
                total_amount: 250,
                random_number: '5345',
                order_id: '202506061426231983',
                detailVat: 1,
                create_date: 1749191183,
                carrier_type: '',
                carrier_id1: '',
                carrier_id2: '',
                allowance: [
                  {
                    invoice_type: 'G0401',
                    invoice_status: 99,
                    allowance_type: 2,
                    allowance_number: 'AC12364090AL0001',
                    allowance_date: '20250606',
                    tax_amount: 1,
                    total_amount: 19,
                  },
                ],
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

        if (url === `${baseUrl}/json/g0501`) {
          return {
            data: {
              code: 0,
              msg: '',
            },
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      const invoice = await invoiceGateway.query({
        orderId: '202506061426231983',
      });

      expect(invoice.allowances.length).toBe(1);
      expect(invoice.allowances[0].status).toBe(InvoiceAllowanceState.ISSUED);

      const result = await invoiceGateway.invalidAllowance(invoice.allowances[0]);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseUrl}/json/g0501`,
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      expect(invoice.allowances[0].status).toBe(InvoiceAllowanceState.INVALID);
      expect(invoice.allowances[0].invalidOn).toBeInstanceOf(Date);
      expect(result.invoiceNumber).toBe('AC12364090');
    });

    it('should throw error when invalid allowance API returns error code', async () => {
      mockedAxios.post.mockImplementation(async (url: string, _data: any) => {
        if (url === `${baseUrl}/json/g0501`) {
          return {
            data: {
              code: 1001,
              msg: 'Cannot invalid allowance',
            },
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      const mockInvoice = new AmegoInvoice({
        orderId: 'test123',
        invoiceNumber: 'AC12364091',
        items: [
          {
            name: '商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
        taxType: TaxType.TAXED,
        issuedOn: new Date(),
        allowances: [],
        randomCode: '1234',
        state: InvoiceState.ISSUED,
        voidOn: null,
      });

      const mockAllowance = new AmegoAllowance({
        allowanceNumber: 'AC12364091AL0001',
        allowancedOn: new Date(),
        allowancePrice: 50,
        items: [
          {
            name: '商品',
            quantity: 1,
            unitPrice: 50,
            taxType: TaxType.TAXED,
          },
        ],
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice: mockInvoice,
      });

      await expect(invoiceGateway.invalidAllowance(mockAllowance)).rejects.toThrow(
        'Amego invoice cancel void failed: Cannot invalid allowance',
      );
    });
  });
});
