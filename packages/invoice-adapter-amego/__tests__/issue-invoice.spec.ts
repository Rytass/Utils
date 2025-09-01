/**
 * @jest-environment node
 */
import { DateTime } from 'luxon';
import {
  AmegoBaseUrls,
  AmegoInvoiceGateway,
  TaxType,
  InvoiceCarrierType,
  SpecialTaxCode,
} from '../src';
import axios from 'axios';

const DEFAULT_VAT_NUMBER = '12345678';
const DEFAULT_APP_KEY = 'sHeq7t8G1wiQvhAuIM27';
const baseUrl = AmegoBaseUrls.DEVELOPMENT;

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AmegoInvoiceGateway Issue Invoice', () => {
  let invoiceGateway: AmegoInvoiceGateway;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create gateway with default options', () => {
      const gateway = new AmegoInvoiceGateway();

      expect(gateway).toBeInstanceOf(AmegoInvoiceGateway);
    });

    it('should create gateway with custom options', () => {
      const gateway = new AmegoInvoiceGateway({
        appKey: DEFAULT_APP_KEY,
        vatNumber: DEFAULT_VAT_NUMBER,
        baseUrl: AmegoBaseUrls.PRODUCTION,
      });

      expect(gateway).toBeInstanceOf(AmegoInvoiceGateway);
    });
  });

  describe('issue invoice', () => {
    beforeEach(() => {
      invoiceGateway = new AmegoInvoiceGateway();
    });

    describe('with valid data', () => {
      beforeEach(() => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 0,
            msg: '',
            invoice_number: 'AC12367705',
            invoice_time: DateTime.now().toSeconds(),
            random_number: '6121',
            barcode: '11406AC123677056121',
            qrcode_left:
              'AC1236770511406096121000000ee000000fa5588071012345678Kl5uSAlhCfQMd3WjsCxKiQ==:**********:1:2:0:',
            qrcode_right: '**口香糖:10:10',
          },
        });
      });

      it('should issue with default options success', async () => {
        const invoice = await invoiceGateway.issue({
          orderId: '202506091426231986',
          vatNumber: '55880710',
          buyerEmail: '',
          items: [
            {
              name: '口香糖',
              quantity: 10,
              unitPrice: 10,
              taxType: TaxType.TAXED,
            },
            {
              name: '巧克力',
              quantity: 10,
              unitPrice: 15,
              taxType: TaxType.TAXED,
            },
          ],
          taxType: TaxType.TAXED,
          detailVat: true,
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
          `${baseUrl}/json/f0401`,
          expect.any(String),
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }),
        );

        expect(invoice.orderId).toBe('202506091426231986');
        expect(invoice.vatNumber).toBe('55880710');
        expect(invoice.invoiceNumber).toBe('AC12367705');
        expect(invoice.issuedAmount).toBe(250);
        expect(invoice.invoiceNumber.length).toBe(10);
      });

      it('should issue invoice with mobile carrier', async () => {
        const invoice = await invoiceGateway.issue({
          orderId: '202506091426231987',
          vatNumber: '55880710',
          buyerEmail: 'test@example.com',
          carrier: { type: InvoiceCarrierType.MOBILE, code: '/DDPD7U2' },
          items: [
            {
              name: '口香糖',
              quantity: 5,
              unitPrice: 20,
              taxType: TaxType.TAXED,
            },
          ],
          taxType: TaxType.TAXED,
          detailVat: true,
        });

        expect(invoice.orderId).toBe('202506091426231987');
        expect(invoice.issuedAmount).toBe(100);
      });

      it('should issue invoice with MOICA carrier', async () => {
        const invoice = await invoiceGateway.issue({
          orderId: '202506091426231988',
          vatNumber: '55880710',
          buyerEmail: 'test@example.com',
          carrier: { type: InvoiceCarrierType.MOICA, code: 'CA123456789' },
          items: [
            {
              name: '商品',
              quantity: 1,
              unitPrice: 100,
              taxType: TaxType.TAXED,
            },
          ],
          taxType: TaxType.TAXED,
          detailVat: true,
        });

        expect(invoice.orderId).toBe('202506091426231988');
      });

      it('should issue invoice with platform carrier', async () => {
        const invoice = await invoiceGateway.issue({
          orderId: '202506091426231989',
          vatNumber: '55880710',
          buyerEmail: 'test@example.com',
          carrier: { type: InvoiceCarrierType.PLATFORM, code: '' },
          items: [
            {
              name: '商品',
              quantity: 1,
              unitPrice: 100,
              taxType: TaxType.TAXED,
            },
          ],
          taxType: TaxType.TAXED,
          detailVat: true,
        });

        expect(invoice.orderId).toBe('202506091426231989');
      });

      it('should issue invoice with love code carrier', async () => {
        const invoice = await invoiceGateway.issue({
          orderId: '202506091426231990',
          vatNumber: '55880710',
          buyerEmail: 'test@example.com',
          carrier: { type: InvoiceCarrierType.LOVE_CODE, code: '001' },
          items: [
            {
              name: '商品',
              quantity: 1,
              unitPrice: 100,
              taxType: TaxType.TAXED,
            },
          ],
          taxType: TaxType.TAXED,
          detailVat: true,
        });

        expect(invoice.orderId).toBe('202506091426231990');
      });

      it('should issue invoice without VAT number (consumer)', async () => {
        const invoice = await invoiceGateway.issue({
          orderId: '202506091426231991',
          buyerEmail: 'consumer@example.com',
          items: [
            {
              name: '商品',
              quantity: 1,
              unitPrice: 100,
              taxType: TaxType.TAXED,
              unit: '個',
              remark: '測試商品',
            },
          ],
          taxType: TaxType.TAXED,
          detailVat: true,
        });

        expect(invoice.orderId).toBe('202506091426231991');
        expect(invoice.vatNumber).toBe('0000000000'); // Default value for consumer
      });

      it('should issue invoice with tax-free items', async () => {
        const invoice = await invoiceGateway.issue({
          orderId: '202506091426231992',
          vatNumber: '55880710',
          items: [
            {
              name: '免稅商品',
              quantity: 1,
              unitPrice: 100,
              taxType: TaxType.TAX_FREE,
            },
          ],
          taxType: TaxType.TAX_FREE,
          detailVat: true,
        });

        expect(invoice.orderId).toBe('202506091426231992');
        expect(invoice.issuedAmount).toBe(100);
      });

      it('should issue invoice with zero tax items', async () => {
        const invoice = await invoiceGateway.issue({
          orderId: '202506091426231993',
          vatNumber: '55880710',
          items: [
            {
              name: '零稅率商品',
              quantity: 1,
              unitPrice: 100,
              taxType: TaxType.ZERO_TAX,
            },
          ],
          taxType: TaxType.ZERO_TAX,
          detailVat: true,
        });

        expect(invoice.orderId).toBe('202506091426231993');
        expect(invoice.issuedAmount).toBe(100);
      });

      it('should issue invoice with custom tax rate', async () => {
        const invoice = await invoiceGateway.issue({
          orderId: '202506091426231994',
          vatNumber: '55880710',
          items: [
            {
              name: '商品',
              quantity: 1,
              unitPrice: 100,
              taxType: TaxType.TAXED,
            },
          ],
          taxType: TaxType.TAXED,
          detailVat: false,
          taxRate: 0.1,
        });

        expect(invoice.orderId).toBe('202506091426231994');
      });

      it('should issue invoice with buyer name', async () => {
        const invoice = await invoiceGateway.issue({
          orderId: '202506091426231995',
          vatNumber: '55880710',
          buyerName: '測試公司',
          items: [
            {
              name: '商品',
              quantity: 1,
              unitPrice: 100,
              taxType: TaxType.TAXED,
            },
          ],
          taxType: TaxType.TAXED,
          detailVat: true,
        });

        expect(invoice.orderId).toBe('202506091426231995');
      });
    });

    describe('validation errors', () => {
      it('should throw error when orderId is missing', async () => {
        await expect(
          invoiceGateway.issue({
            orderId: '',
            items: [
              {
                name: '商品',
                quantity: 1,
                unitPrice: 100,
                taxType: TaxType.TAXED,
              },
            ],
            taxType: TaxType.TAXED,
            detailVat: true,
          }),
        ).rejects.toThrow('Order ID is required');
      });

      it('should throw error when VAT number is invalid', async () => {
        await expect(
          invoiceGateway.issue({
            orderId: 'test123',
            vatNumber: 'invalid',
            items: [
              {
                name: '商品',
                quantity: 1,
                unitPrice: 100,
                taxType: TaxType.TAXED,
              },
            ],
            taxType: TaxType.TAXED,
            detailVat: true,
          }),
        ).rejects.toThrow('Invalid VAT number format');
      });

      it('should throw error when detailVat is false without vatNumber', async () => {
        await expect(
          invoiceGateway.issue({
            orderId: 'test123',
            items: [
              {
                name: '商品',
                quantity: 1,
                unitPrice: 100,
                taxType: TaxType.TAXED,
              },
            ],
            taxType: TaxType.TAXED,
            detailVat: false,
          }),
        ).rejects.toThrow(
          '未稅價發票必須提供統一編號 (DetailVat=0 requires VAT number)',
        );
      });

      it('should throw error when orderId is too long', async () => {
        await expect(
          invoiceGateway.issue({
            orderId: 'a'.repeat(41),
            vatNumber: '55880710',
            items: [
              {
                name: '商品',
                quantity: 1,
                unitPrice: 100,
                taxType: TaxType.TAXED,
              },
            ],
            taxType: TaxType.TAXED,
            detailVat: true,
          }),
        ).rejects.toThrow(
          'Order ID must be less than or equal to 40 characters',
        );
      });

      it('should throw error when no items provided', async () => {
        await expect(
          invoiceGateway.issue({
            orderId: 'test123',
            vatNumber: '55880710',
            items: [],
            taxType: TaxType.TAXED,
            detailVat: true,
          }),
        ).rejects.toThrow('At least one product item is required');
      });

      it('should throw error when item name is too long', async () => {
        await expect(
          invoiceGateway.issue({
            orderId: 'test123',
            vatNumber: '55880710',
            items: [
              {
                name: 'a'.repeat(257),
                quantity: 1,
                unitPrice: 100,
                taxType: TaxType.TAXED,
              },
            ],
            taxType: TaxType.TAXED,
            detailVat: true,
          }),
        ).rejects.toThrow(
          'Item description must be less than or equal to 256 characters',
        );
      });

      it('should throw error when item unit is too long', async () => {
        await expect(
          invoiceGateway.issue({
            orderId: 'test123',
            vatNumber: '55880710',
            items: [
              {
                name: '商品',
                quantity: 1,
                unitPrice: 100,
                taxType: TaxType.TAXED,
                unit: 'a'.repeat(7),
              },
            ],
            taxType: TaxType.TAXED,
            detailVat: true,
          }),
        ).rejects.toThrow(
          'Item unit must be less than or equal to 6 characters',
        );
      });

      it('should throw error when item remark is too long', async () => {
        await expect(
          invoiceGateway.issue({
            orderId: 'test123',
            vatNumber: '55880710',
            items: [
              {
                name: '商品',
                quantity: 1,
                unitPrice: 100,
                taxType: TaxType.TAXED,
                remark: 'a'.repeat(41),
              },
            ],
            taxType: TaxType.TAXED,
            detailVat: true,
          }),
        ).rejects.toThrow(
          'Item remark must be less than or equal to 40 characters',
        );
      });

      it('should throw error when platform carrier without email', async () => {
        await expect(
          invoiceGateway.issue({
            orderId: 'test123',
            vatNumber: '55880710',
            carrier: { type: InvoiceCarrierType.PLATFORM, code: '' },
            items: [
              {
                name: '商品',
                quantity: 1,
                unitPrice: 100,
                taxType: TaxType.TAXED,
              },
            ],
            taxType: TaxType.TAXED,
            detailVat: true,
          }),
        ).rejects.toThrow(
          'Platform carrier should provide buyer email to received notification',
        );
      });
    });

    describe('API errors', () => {
      it('should throw error when API returns error code', async () => {
        mockedAxios.post.mockResolvedValue({
          data: {
            code: 1001,
            msg: 'API Error',
          },
        });

        await expect(
          invoiceGateway.issue({
            orderId: 'test123',
            vatNumber: '55880710',
            items: [
              {
                name: '商品',
                quantity: 1,
                unitPrice: 100,
                taxType: TaxType.TAXED,
              },
            ],
            taxType: TaxType.TAXED,
            detailVat: true,
          }),
        ).rejects.toThrow('Amego invoice issue failed: API Error');
      });
    });
  });

  describe('getCarrierInfo', () => {
    beforeEach(() => {
      invoiceGateway = new AmegoInvoiceGateway();
    });

    it('should return platform carrier info', () => {
      const result = invoiceGateway.getCarrierInfo({
        carrier: { type: InvoiceCarrierType.PLATFORM, code: '' },
        buyerEmail: 'test@example.com',
      });

      expect(result).toEqual({
        carrierId: 'test@example.com',
        carrierType: 'amego',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });
    });

    it('should return mobile carrier info', () => {
      const result = invoiceGateway.getCarrierInfo({
        carrier: { type: InvoiceCarrierType.MOBILE, code: '/DDPD7U2' },
        buyerEmail: 'test@example.com',
      });

      expect(result).toEqual({
        carrierId: '/DDPD7U2',
        carrierType: '3J0002',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });
    });

    it('should return MOICA carrier info', () => {
      const result = invoiceGateway.getCarrierInfo({
        carrier: { type: InvoiceCarrierType.MOICA, code: 'CA123456789' },
        buyerEmail: 'test@example.com',
      });

      expect(result).toEqual({
        carrierId: 'CA123456789',
        carrierType: 'CQ0001',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });
    });

    it('should return love code carrier info', () => {
      const result = invoiceGateway.getCarrierInfo({
        carrier: { type: InvoiceCarrierType.LOVE_CODE, code: '001' },
        buyerEmail: 'test@example.com',
      });

      expect(result).toEqual({
        carrierId: '',
        carrierType: '',
        buyerEmail: 'test@example.com',
        loveCode: '001',
      });
    });

    it('should return default carrier info when no carrier specified', () => {
      const result = invoiceGateway.getCarrierInfo({
        buyerEmail: 'test@example.com',
      });

      expect(result).toEqual({
        carrierId: '',
        carrierType: '',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });
    });

    it('should handle different carrier types in getCarrierInfo', () => {
      // Test platform carrier
      const platformResult = invoiceGateway.getCarrierInfo({
        carrier: {
          type: InvoiceCarrierType.PLATFORM,
          code: 'user@example.com',
        },
        buyerEmail: 'test@example.com',
      });

      expect(platformResult).toEqual({
        carrierId: 'test@example.com',
        carrierType: 'amego',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });

      // Test mobile carrier
      const mobileResult = invoiceGateway.getCarrierInfo({
        carrier: {
          type: InvoiceCarrierType.MOBILE,
          code: '/DDPD7U2',
        },
        buyerEmail: 'test@example.com',
      });

      expect(mobileResult).toEqual({
        carrierId: '/DDPD7U2',
        carrierType: '3J0002',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });

      // Test MOICA carrier
      const moicaResult = invoiceGateway.getCarrierInfo({
        carrier: {
          type: InvoiceCarrierType.MOICA,
          code: 'CA123456789',
        },
        buyerEmail: 'test@example.com',
      });

      expect(moicaResult).toEqual({
        carrierId: 'CA123456789',
        carrierType: 'CQ0001',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });

      // Test love code carrier
      const loveCodeResult = invoiceGateway.getCarrierInfo({
        carrier: {
          type: InvoiceCarrierType.LOVE_CODE,
          code: '001',
        },
        buyerEmail: 'test@example.com',
      });

      expect(loveCodeResult).toEqual({
        carrierId: '',
        carrierType: '',
        buyerEmail: 'test@example.com',
        loveCode: '001',
      });
    });
  });
});
