/**
 * @jest-environment node
 */
import axios from 'axios';
import { AmegoBaseUrls, AmegoInvoiceGateway, InvoiceCarrierType, InvoiceState, TaxType } from '../src';
import { DateTime } from 'luxon';

const DEFAULT_VAT_NUMBER = '12345678';
const DEFAULT_APP_KEY = 'sHeq7t8G1wiQvhAuIM27';
const baseUrl = AmegoBaseUrls.DEVELOPMENT;

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Amego Invoice Query', () => {
  let invoiceGateway: AmegoInvoiceGateway;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isMobileBarcodeValid', () => {
    describe('with default gateway options', () => {
      beforeEach(() => {
        invoiceGateway = new AmegoInvoiceGateway();
      });

      it('should return true for valid barcode', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
          },
        });

        const isValid = await invoiceGateway.isMobileBarcodeValid('/DDPD7U2');

        expect(mockedAxios.post).toHaveBeenCalledWith(
          `${baseUrl}/json/barcode`,
          expect.any(String),
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }),
        );

        expect(isValid).toBe(true);
      });

      it('should return false for invalid barcode', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 9000113,
            msg: 'Invalid barcode',
          },
        });

        const isValid = await invoiceGateway.isMobileBarcodeValid('/DDPD7U3');

        expect(isValid).toBe(false);
      });
    });

    describe('with specific gateway options', () => {
      beforeEach(() => {
        invoiceGateway = new AmegoInvoiceGateway({
          appKey: DEFAULT_APP_KEY,
          vatNumber: DEFAULT_VAT_NUMBER,
          baseUrl: AmegoBaseUrls.DEVELOPMENT,
        });
      });

      it('should return true for valid barcode', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
          },
        });

        const isValid = await invoiceGateway.isMobileBarcodeValid('/DDPD7U2');

        expect(isValid).toBe(true);
      });

      it('should return false for invalid barcode', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 9000113,
            msg: 'Invalid barcode',
          },
        });

        const isValid = await invoiceGateway.isMobileBarcodeValid('/DDPD7U3');

        expect(isValid).toBe(false);
      });
    });
  });

  describe('isLoveCodeValid', () => {
    beforeEach(() => {
      invoiceGateway = new AmegoInvoiceGateway();
    });

    it('should throw error as method is not supported', async () => {
      await expect(invoiceGateway.isLoveCodeValid('001')).rejects.toThrow('Method not supported in Amego API.');
    });
  });

  describe('query invoice', () => {
    beforeEach(() => {
      invoiceGateway = new AmegoInvoiceGateway({
        appKey: DEFAULT_APP_KEY,
        vatNumber: DEFAULT_VAT_NUMBER,
        baseUrl: AmegoBaseUrls.DEVELOPMENT,
      });
    });

    describe('by orderId', () => {
      it('should query invoice successfully', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364096',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6476',
              order_id: '3g49n3',
              create_date: 1749191454,
              carrier_type: '3J0002',
              carrier_id1: '/DDPD7U2',
              carrier_id2: '',
              product_item: [
                {
                  description: '口香糖',
                  quantity: 10,
                  unit_price: 10,
                  tax_type: 1,
                  amount: 100,
                  unit: '個',
                  remark: '測試商品',
                },
                {
                  description: '巧克力',
                  quantity: 10,
                  unit_price: 15,
                  tax_type: 1,
                  amount: 150,
                  unit: '',
                  remark: '',
                },
              ],
              allowance: [],
            },
          },
        });

        const invoice = await invoiceGateway.query({ orderId: '3g49n3' });

        expect(mockedAxios.post).toHaveBeenCalledWith(
          `${baseUrl}/json/invoice_query`,
          expect.any(String),
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }),
        );

        expect(invoice.orderId).toBe('3g49n3');
        expect(invoice.invoiceNumber).toBe('AC12364096');
        expect(invoice.vatNumber).toBe('55880710');
        expect(invoice.randomCode).toBe('6476');
        expect(invoice.state).toBe(InvoiceState.ISSUED);
        expect(invoice.taxType).toBe(TaxType.TAXED);
        expect(invoice.taxRate).toBe(0.05);
        expect(invoice.carrier).toEqual({
          type: InvoiceCarrierType.MOBILE,
          code: '/DDPD7U2',
        });

        expect(invoice.items).toHaveLength(2);
        expect(invoice.items[0]).toEqual({
          taxType: TaxType.TAXED,
          name: '口香糖',
          unitPrice: 10,
          quantity: 10,
          amount: 100,
          unit: '個',
          remark: '測試商品',
        });

        expect(invoice.allowances).toHaveLength(0);
      });

      it('should query invoice with MOICA carrier', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364097',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6476',
              order_id: '3g49n4',
              create_date: 1749191454,
              carrier_type: 'CQ0001',
              carrier_id1: '',
              carrier_id2: 'CA123456789',
              product_item: [
                {
                  description: '商品',
                  quantity: 1,
                  unit_price: 100,
                  tax_type: 1,
                  amount: 100,
                },
              ],
              allowance: [],
            },
          },
        });

        const invoice = await invoiceGateway.query({ orderId: '3g49n4' });

        expect(invoice.carrier).toEqual({
          type: InvoiceCarrierType.MOICA,
          code: 'CA123456789',
        });
      });

      it('should query invoice with platform carrier', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364098',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6476',
              order_id: '3g49n6',
              create_date: 1749191454,
              carrier_type: 'amego',
              carrier_id1: 'user@example.com',
              carrier_id2: '',
              product_item: [
                {
                  description: '商品',
                  quantity: 1,
                  unit_price: 100,
                  tax_type: 1,
                  amount: 100,
                },
              ],
              allowance: [],
            },
          },
        });

        const invoice = await invoiceGateway.query({ orderId: '3g49n6' });

        expect(invoice.carrier).toEqual({
          type: InvoiceCarrierType.PLATFORM,
          code: 'user@example.com',
        });
      });

      it('should query invoice with love code carrier', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364099',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6477',
              order_id: '3g49n7',
              create_date: 1749191454,
              carrier_type: 'LOVECODE',
              carrier_id1: '919',
              carrier_id2: '',
              product_item: [
                {
                  description: '商品',
                  quantity: 1,
                  unit_price: 100,
                  tax_type: 1,
                  amount: 100,
                },
              ],
              allowance: [],
            },
          },
        });

        const invoice = await invoiceGateway.query({ orderId: '3g49n7' });

        expect(invoice.carrier).toEqual({
          type: InvoiceCarrierType.LOVE_CODE,
          code: '919',
        });
      });

      it('should query invoice with love code carrier (7 digits)', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364099',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6477',
              order_id: '3g49n7-max',
              create_date: 1749191454,
              carrier_type: 'UNKNOWN_LOVECODE',
              carrier_id1: '1234567', // 7位數愛心碼
              carrier_id2: '',
              product_item: [
                {
                  description: '商品',
                  quantity: 1,
                  unit_price: 100,
                  tax_type: 1,
                  amount: 100,
                },
              ],
              allowance: [],
            },
          },
        });

        const invoice = await invoiceGateway.query({ orderId: '3g49n7-max' });

        expect(invoice.carrier).toEqual({
          type: InvoiceCarrierType.LOVE_CODE,
          code: '1234567',
        });
      });

      it('should query invoice with invalid love code (contains letters)', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364099',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6477',
              order_id: '3g49n7-invalid',
              create_date: 1749191454,
              carrier_type: 'UNKNOWN_TYPE',
              carrier_id1: '12A3', // 包含字母，不是純數字
              carrier_id2: '',
              product_item: [
                {
                  description: '商品',
                  quantity: 1,
                  unit_price: 100,
                  tax_type: 1,
                  amount: 100,
                },
              ],
              allowance: [],
            },
          },
        });

        const invoice = await invoiceGateway.query({
          orderId: '3g49n7-invalid',
        });

        expect(invoice.carrier).toBeUndefined();
      });

      it('should query invoice with invalid love code (too long)', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364099',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6477',
              order_id: '3g49n7-toolong',
              create_date: 1749191454,
              carrier_type: 'UNKNOWN_TYPE',
              carrier_id1: '12345678', // 8位數，超過7位限制
              carrier_id2: '',
              product_item: [
                {
                  description: '商品',
                  quantity: 1,
                  unit_price: 100,
                  tax_type: 1,
                  amount: 100,
                },
              ],
              allowance: [],
            },
          },
        });

        const invoice = await invoiceGateway.query({
          orderId: '3g49n7-toolong',
        });

        expect(invoice.carrier).toBeUndefined();
      });

      it('should query invoice without carrier', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364098',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6476',
              order_id: '3g49n5',
              create_date: 1749191454,
              carrier_type: '',
              carrier_id1: '',
              carrier_id2: '',
              product_item: [
                {
                  description: '商品',
                  quantity: 1,
                  unit_price: 100,
                  tax_type: 1,
                  amount: 100,
                },
              ],
              allowance: [],
            },
          },
        });

        const invoice = await invoiceGateway.query({ orderId: '3g49n5' });

        expect(invoice.carrier).toBeUndefined();
      });

      it('should query invoice with unknown carrier type and short code', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364099',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6476',
              order_id: '3g49n5-unknown',
              create_date: 1749191454,
              carrier_type: 'UNKNOWN_TYPE',
              carrier_id1: 'AB', // 長度小於3的代碼
              carrier_id2: '',
              product_item: [
                {
                  description: '商品',
                  quantity: 1,
                  unit_price: 100,
                  tax_type: 1,
                  amount: 100,
                },
              ],
              allowance: [],
            },
          },
        });

        const invoice = await invoiceGateway.query({
          orderId: '3g49n5-unknown',
        });

        expect(invoice.carrier).toBeUndefined();
      });

      it('should query invoice with allowances', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364099',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6476',
              order_id: '3g49n6',
              create_date: 1749191454,
              carrier_type: '',
              carrier_id1: '',
              carrier_id2: '',
              product_item: [
                {
                  description: '商品',
                  quantity: 1,
                  unit_price: 100,
                  tax_type: 1,
                  amount: 100,
                },
              ],
              allowance: [
                {
                  invoice_type: 'G0401',
                  invoice_status: 99,
                  allowance_type: 2,
                  allowance_number: 'AC12364099AL0001',
                  allowance_date: '20250606',
                  tax_amount: 5,
                  total_amount: 45,
                },
                {
                  invoice_type: 'G0501',
                  invoice_status: 91,
                  allowance_type: 2,
                  allowance_number: 'AC12364099AL0002',
                  allowance_date: '20250607',
                  tax_amount: 2,
                  total_amount: 18,
                },
              ],
            },
          },
        });

        const invoice = await invoiceGateway.query({ orderId: '3g49n6' });

        expect(invoice.allowances).toHaveLength(2);
        expect(invoice.allowances[0].allowanceNumber).toBe('AC12364099AL0001');
        expect(invoice.allowances[0].allowancePrice).toBe(50);
        expect(invoice.allowances[1].allowanceNumber).toBe('AC12364099AL0002');
        expect(invoice.allowances[1].allowancePrice).toBe(20);
      });

      it('should handle allowances with invalid type but issued status (coverage test)', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              order_id: '202506091426231987',
              invoice_number: 'AC12367706',
              random_number: '6122',
              invoice_type: 'C0401',
              invoice_date: '20250609',
              invoice_time: '22:20:29',
              buyer_identifier: '55880710',
              carrier_type: '3J0002',
              carrier_id1: '/DDPD7U2',
              carrier_id2: '',
              tax_rate: '0.05',
              tax_type: 1,
              allowance: [
                {
                  invoice_type: 'G0501', // Invalid type
                  invoice_status: 99, // But status is still issued (not 91)
                  allowance_type: '2',
                  allowance_number: 'AC12367706AL0001',
                  allowance_date: '20250609',
                  tax_amount: 1,
                  total_amount: 19,
                },
                {
                  invoice_type: 'D0501', // Invalid type
                  invoice_status: 99, // But status is still issued (not 91)
                  allowance_type: '2',
                  allowance_number: 'AC12367706AL0002',
                  allowance_date: '20250610',
                  tax_amount: 2,
                  total_amount: 38,
                },
              ],
              product_item: [
                {
                  tax_type: 1,
                  description: '測試商品',
                  unit_price: 100,
                  quantity: 1,
                  amount: 100,
                },
              ],
            },
          },
        });

        const result = await invoiceGateway.query({
          orderId: '202506091426231987',
        });

        expect(result.allowances).toHaveLength(2);
        // Both allowances should be marked as invalid due to their invoice_type
        expect(result.allowances[0].status).toBe('INVALID');
        expect(result.allowances[1].status).toBe('INVALID');
        // Their invalidOn should be set to their allowance date
        expect(result.allowances[0].invalidOn).toEqual(DateTime.fromFormat('20250609', 'yyyyMMdd').toJSDate());

        expect(result.allowances[1].invalidOn).toEqual(DateTime.fromFormat('20250610', 'yyyyMMdd').toJSDate());
      });
    });

    describe('by invoiceNumber', () => {
      it('should query invoice successfully', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364096',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6476',
              order_id: '3g49n3',
              create_date: 1749191454,
              carrier_type: '',
              carrier_id1: '',
              carrier_id2: '',
              product_item: [
                {
                  description: '商品',
                  quantity: 1,
                  unit_price: 100,
                  tax_type: 1,
                  amount: 100,
                },
              ],
              allowance: [],
            },
          },
        });

        const invoice = await invoiceGateway.query({
          invoiceNumber: 'AC12364096',
        });

        expect(invoice.orderId).toBe('3g49n3');
        expect(invoice.invoiceNumber).toBe('AC12364096');
      });
    });

    describe('API errors', () => {
      it('should throw error when API returns error code', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 1001,
            msg: 'Invoice not found',
          },
        });

        await expect(invoiceGateway.query({ orderId: 'nonexistent' })).rejects.toThrow(
          'Amego invoice query failed: Invoice not found',
        );
      });

      it('should handle carrier parsing with carrierId2 when carrierId1 is empty', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364100',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: '20250606',
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6476',
              order_id: '3g49n8',
              create_date: 1749191454,
              carrier_type: 'CQ0001',
              carrier_id1: '', // Empty carrierId1
              carrier_id2: 'CA123456789', // Using carrierId2
              product_item: [
                {
                  description: '商品',
                  quantity: 1,
                  unit_price: 100,
                  tax_type: 1,
                  amount: 100,
                },
              ],
              allowance: [],
            },
          },
        });

        const invoice = await invoiceGateway.query({ orderId: '3g49n8' });

        expect(invoice.carrier).toEqual({
          type: InvoiceCarrierType.MOICA,
          code: 'CA123456789',
        });
      });
    });
  });
});
