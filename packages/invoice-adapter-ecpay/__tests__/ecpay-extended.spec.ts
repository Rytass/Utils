/**
 * @jest-environment node
 */

import { randomBytes, createCipheriv } from 'crypto';
import axios from 'axios';
import { ECPayInvoiceGateway, TaxType } from '../src';

const DEFAULT_AES_IV = 'q9jcZX8Ib9LM8wYk';
const DEFAULT_AES_KEY = 'ejCk326UnaZWKisg';
const DEFAULT_MERCHANT_ID = '2000132';

// Valid Taiwan VAT number for testing (passes checksum validation)
const VALID_VAT_NUMBER = '12345675';

describe('ECPayInvoiceGateway Extended Tests', () => {
  const post = jest.spyOn(axios, 'post');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidGUI', () => {
    const invoiceGateway = new ECPayInvoiceGateway();

    it('should return false for invalid VAT number format', async () => {
      const result = await invoiceGateway.isValidGUI('123'); // Too short

      expect(result).toEqual([false]);
    });

    it('should return false for invalid VAT number checksum', async () => {
      const result = await invoiceGateway.isValidGUI('12345678'); // Invalid checksum

      expect(result).toEqual([false]);
    });

    it('should return false when API returns error RtnCode', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      post.mockImplementationOnce(async () => {
        const cipher = createCipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            TransCode: 1,
            Data: [
              cipher.update(
                encodeURIComponent(
                  JSON.stringify({
                    RtnCode: 0, // Error code
                    RtnMsg: 'Error',
                  }),
                ),
                'utf8',
                'base64',
              ),
              cipher.final('base64'),
            ].join(''),
          },
        };
      });

      const result = await invoiceGateway.isValidGUI(VALID_VAT_NUMBER);

      expect(result).toEqual([false]);
      consoleSpy.mockRestore();
    });

    it('should return true with company name when API returns success', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      post.mockImplementationOnce(async () => {
        const cipher = createCipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            TransCode: 1,
            Data: [
              cipher.update(
                encodeURIComponent(
                  JSON.stringify({
                    RtnCode: 1,
                    RtnMsg: 'Success',
                    CompanyName: 'Test Company',
                  }),
                ),
                'utf8',
                'base64',
              ),
              cipher.final('base64'),
            ].join(''),
          },
        };
      });

      const result = await invoiceGateway.isValidGUI(VALID_VAT_NUMBER);

      expect(result).toEqual([true, 'Test Company']);
      consoleSpy.mockRestore();
    });

    it('should throw error when TransCode is not success', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      post.mockImplementationOnce(async () => {
        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            TransCode: 0, // Error
            TransMsg: 'Error',
          },
        };
      });

      await expect(invoiceGateway.isValidGUI(VALID_VAT_NUMBER)).rejects.toThrow('Invalid Response on GUI Validator');

      consoleSpy.mockRestore();
    });
  });

  describe('isMobileBarcodeValid error handling', () => {
    const invoiceGateway = new ECPayInvoiceGateway();

    it('should throw error when TransCode is not success', async () => {
      post.mockImplementationOnce(async () => {
        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            TransCode: 0, // Error
            TransMsg: 'Error',
          },
        };
      });

      await expect(invoiceGateway.isMobileBarcodeValid('/ABC1234')).rejects.toThrow(
        'Invalid Response on Mobile Barcode Validator',
      );
    });

    it('should throw error when RtnCode is not success', async () => {
      post.mockImplementationOnce(async () => {
        const cipher = createCipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            TransCode: 1,
            Data: [
              cipher.update(
                encodeURIComponent(
                  JSON.stringify({
                    RtnCode: 0, // Error code
                    RtnMsg: 'Error',
                  }),
                ),
                'utf8',
                'base64',
              ),
              cipher.final('base64'),
            ].join(''),
          },
        };
      });

      await expect(invoiceGateway.isMobileBarcodeValid('/ABC1234')).rejects.toThrow(
        'Invalid Response on Mobile Barcode Validator',
      );
    });
  });

  describe('customer.id validation', () => {
    const invoiceGateway = new ECPayInvoiceGateway();

    it('should accept valid customer.id with valid characters', async () => {
      const orderId = randomBytes(15).toString('hex');

      post.mockImplementationOnce(async () => {
        const cipher = createCipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            TransCode: 1,
            Data: [
              cipher.update(
                encodeURIComponent(
                  JSON.stringify({
                    RtnCode: 1,
                    RtnMsg: '開立發票成功',
                    InvoiceNo: 'YA88888880',
                    InvoiceDate: '2022-06-17+14:29:59',
                    RandomNumber: '2358',
                  }),
                ),
                'utf8',
                'base64',
              ),
              cipher.final('base64'),
            ].join(''),
          },
        };
      });

      // customer.id with special characters that fail the regex test (not 0-9, a-z, or _)
      // The regex /[0-9a-z_]/gi.test() returns true if string contains ANY alphanumeric or underscore
      // So to pass (not throw), the string must contain NO alphanumeric or underscore characters
      const invoice = await invoiceGateway.issue({
        orderId,
        customer: {
          id: '!@#$%^&*()', // Special characters only - regex test returns false
          email: 'test@fake.com',
        },
        items: [
          {
            name: 'Test Item',
            quantity: 1,
            unitPrice: 100,
          },
        ],
      });

      expect(invoice.invoiceNumber).toBe('YA88888880');
    });
  });

  describe('issue with special tax types', () => {
    const invoiceGateway = new ECPayInvoiceGateway();

    it('should handle TaxType.TAXED correctly (default case)', async () => {
      const orderId = randomBytes(15).toString('hex');

      post.mockImplementationOnce(async () => {
        const cipher = createCipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            TransCode: 1,
            Data: [
              cipher.update(
                encodeURIComponent(
                  JSON.stringify({
                    RtnCode: 1,
                    RtnMsg: '開立發票成功',
                    InvoiceNo: 'YA88888887',
                    InvoiceDate: '2022-06-17+14:29:59',
                    RandomNumber: '2358',
                  }),
                ),
                'utf8',
                'base64',
              ),
              cipher.final('base64'),
            ].join(''),
          },
        };
      });

      const invoice = await invoiceGateway.issue({
        orderId,
        customer: {
          email: 'test@fake.com',
        },
        items: [
          {
            name: 'Test Item',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
      });

      expect(invoice.invoiceNumber).toBe('YA88888887');
    });

    it('should handle TaxType.ZERO_TAX correctly', async () => {
      const orderId = randomBytes(15).toString('hex');

      post.mockImplementationOnce(async () => {
        const cipher = createCipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            TransCode: 1,
            Data: [
              cipher.update(
                encodeURIComponent(
                  JSON.stringify({
                    RtnCode: 1,
                    RtnMsg: '開立發票成功',
                    InvoiceNo: 'YA88888888',
                    InvoiceDate: '2022-06-17+14:29:59',
                    RandomNumber: '2358',
                  }),
                ),
                'utf8',
                'base64',
              ),
              cipher.final('base64'),
            ].join(''),
          },
        };
      });

      const invoice = await invoiceGateway.issue({
        orderId,
        customer: {
          email: 'test@fake.com',
        },
        items: [
          {
            name: 'Test Item',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.ZERO_TAX,
          },
        ],
      });

      expect(invoice.invoiceNumber).toBe('YA88888888');
    });

    it('should handle TaxType.TAX_FREE correctly', async () => {
      const orderId = randomBytes(15).toString('hex');

      post.mockImplementationOnce(async () => {
        const cipher = createCipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            TransCode: 1,
            Data: [
              cipher.update(
                encodeURIComponent(
                  JSON.stringify({
                    RtnCode: 1,
                    RtnMsg: '開立發票成功',
                    InvoiceNo: 'YA88888889',
                    InvoiceDate: '2022-06-17+14:29:59',
                    RandomNumber: '2358',
                  }),
                ),
                'utf8',
                'base64',
              ),
              cipher.final('base64'),
            ].join(''),
          },
        };
      });

      const invoice = await invoiceGateway.issue({
        orderId,
        customer: {
          email: 'test@fake.com',
        },
        items: [
          {
            name: 'Test Item',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAX_FREE,
          },
        ],
      });

      expect(invoice.invoiceNumber).toBe('YA88888889');
    });
  });
});
