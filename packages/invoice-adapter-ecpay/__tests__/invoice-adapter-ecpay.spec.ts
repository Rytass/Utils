/**
 * @jest-environment node
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import axios from 'axios';
import { DateTime } from 'luxon';
import { ECPayInvoiceGateway, ECPayInvoiceLoveCodeValidateRequestBody, ECPayInvoiceLoveCodeValidateResponse, ECPayInvoiceMobileBarcodeValidateRequestBody, ECPayInvoiceMobileBarcodeValidateResponse, ECPayInvoiceRequestBody, ECPayIssuedInvoiceResponse, InvoiceCarriers, InvoiceCarrierType, SpecialTaxCode, TaxType } from '../src';

const DEFAULT_AES_IV = 'q9jcZX8Ib9LM8wYk';
const DEFAULT_AES_KEY = 'ejCk326UnaZWKisg';
const DEFAULT_MERCHANT_ID = '2000132';

const AES_IV = randomBytes(8).toString('hex');
const AES_KEY = randomBytes(8).toString('hex');
const MERCHANT_ID = '9999999';

describe('ECPayInvoiceGateway', () => {
  describe('default options', () => {
    const post = jest.spyOn(axios, 'post');
    const invoiceGateway = new ECPayInvoiceGateway();

    it('should issue with default aes options', (done) => {
      const orderId = randomBytes(15).toString('hex');

      post.mockImplementation(async (url: string, data: unknown) => {
        const payload = JSON.parse(data as string) as {
          MerchantID: string;
          RqHeader: {
            Timestamp: number;
            Revision: '3.0.0';
          };
          Data: string;
        };

        expect(payload.MerchantID).toBe(DEFAULT_MERCHANT_ID);

        const decipher = createDecipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

        const plainPayload = JSON.parse(
          decodeURIComponent(
            [
              decipher.update(payload.Data, 'base64', 'utf8'),
              decipher.final('utf8'),
            ].join('')
          )
        ) as {
          RelateNumber: string;
        };

        expect(plainPayload.RelateNumber).toBe(orderId);

        const cipher = createCipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: {
            MerchantID: MERCHANT_ID,
            RpHeader: {
              Timestamp: Math.round(Date.now() / 1000),
            },
            TransCode: 1,
            TransMsg: '',
            Data: [
              cipher.update(encodeURIComponent(JSON.stringify({
                RtnCode: 1,
                RtnMsg: '開立發票成功',
                InvoiceNo: 'YA88888888',
                InvoiceDate: '2022-06-17+14:29:59',
                RandomNumber: '2358',
              })), 'utf8', 'base64'),
              cipher.final('base64'),
            ].join(''),
          },
        };
      });

      invoiceGateway.issue({
        orderId,
        customer: {
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      }).then((invoice) => {
        expect(invoice.invoiceNumber).toBe('YA88888888');

        done();
      });
    });
  });

  describe('issue invoice', () => {
    const post = jest.spyOn(axios, 'post');

    const invoiceGateway = new ECPayInvoiceGateway({
      aesIv: AES_IV,
      aesKey: AES_KEY,
      merchantId: MERCHANT_ID,
    });

    function parseRequest<T = ECPayInvoiceRequestBody>(data: string): T {
      const payload = JSON.parse(data as string) as {
        MerchantID: string;
        RqHeader: {
          Timestamp: number;
          Revision: '3.0.0';
        };
        Data: string;
      };

      const decipher = createDecipheriv('aes-128-cbc', AES_KEY, AES_IV);

      const plainPayload = JSON.parse(
        decodeURIComponent(
          [
            decipher.update(payload.Data, 'base64', 'utf8'),
            decipher.final('utf8'),
          ].join('')
        )
      );

      return plainPayload;
    }

    function generateIssueResponse<T = ECPayIssuedInvoiceResponse>(options: T) {
      const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

      cipher.setAutoPadding(true);

      return {
        MerchantID: MERCHANT_ID,
        RpHeader: {
          Timestamp: Math.round(Date.now() / 1000),
        },
        TransCode: 1,
        TransMsg: '',
        Data: [
          cipher.update(encodeURIComponent(JSON.stringify(options)), 'utf8', 'base64'),
          cipher.final('base64'),
        ].join(''),
      };
    }

    it('should issue common invoice', (done) => {
      const invoiceDate = '2022-06-17+14:29:59';

      post.mockImplementation(async (url: string, data: unknown) => ({
        data: generateIssueResponse({
          RtnCode: 1,
          RtnMsg: '開立發票成功',
          InvoiceNo: 'YA88888888',
          InvoiceDate: invoiceDate,
          RandomNumber: '2358',
        }),
      }));

      invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        customer: {
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 2,
          unitPrice: 10,
        }],
      }).then((invoice) => {
        expect(invoice.randomCode).toBe('2358');
        expect(invoice.invoiceNumber).toBe('YA88888888');
        expect(invoice.issuedAmount).toBe(20);
        expect(DateTime.fromJSDate(invoice.issuedOn).toFormat('yyyy-MM-dd HH:mm:ss')).toBe('2022-06-17 14:29:59');

        done();
      });
    });

    it('should issue failed by ecpay', () => {
      const invoiceDate = '2022-06-17+14:29:59';

      post.mockImplementation(async (url: string, data: unknown) => ({
        data: generateIssueResponse({
          RtnCode: -1,
          RtnMsg: '開立發票失敗',
          InvoiceNo: 'YA88888888',
          InvoiceDate: invoiceDate,
          RandomNumber: '2358',
        }),
      }));

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        customer: {
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();
    });

    it('should issue failed by ecpay gateway', () => {
      const invoiceDate = '2022-06-17+14:29:59';

      post.mockImplementation(async (url: string, data: unknown) => {
        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: {
            MerchantID: MERCHANT_ID,
            RpHeader: {
              Timestamp: Math.round(Date.now() / 1000),
            },
            TransCode: 998,
            TransMsg: '',
            Data: [
              cipher.update(encodeURIComponent(JSON.stringify({
                RtnCode: 1,
                RtnMsg: '開立發票通道失敗',
                InvoiceNo: 'YA88888888',
                InvoiceDate: invoiceDate,
                RandomNumber: '2358',
              })), 'utf8', 'base64'),
              cipher.final('base64'),
            ].join(''),
          },
        };
      });

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        customer: {
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();
    });

    it('should print invoice', (done) => {
      post.mockImplementation(async (url: string, data: unknown) => {
        const plainPayload = parseRequest(data as string);

        expect(plainPayload.Print).toBe('1');
        expect(plainPayload.CarrierType).toBe('');
        expect(plainPayload.CarrierNum).toBe('');
        expect(plainPayload.Items[0].ItemAmount).toBe(10);
        expect(plainPayload.Items[1].ItemAmount).toBe(16);

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.PRINT,
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
          taxType: TaxType.TAXED,
        }, {
          name: 'Pencil',
          quantity: 2,
          unitPrice: 8,
        }],
      }).then(() => {
        done();
      });
    });

    it('should issue tax free invoice', (done) => {
      post.mockImplementation(async (url: string, data: unknown) => {
        const plainPayload = parseRequest(data as string);

        expect(plainPayload.Print).toBe('1');
        expect(plainPayload.InvType).toBe('07');
        expect(plainPayload.TaxType).toBe('2');
        expect(plainPayload.SpecialTaxType).toBe(0);

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.PRINT,
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
          taxType: TaxType.TAX_FREE,
        }],
      }).then(() => {
        done();
      });
    });

    it('should issue zero tax invoice', (done) => {
      post.mockImplementation(async (url: string, data: unknown) => {
        const plainPayload = parseRequest(data as string);

        expect(plainPayload.Print).toBe('1');
        expect(plainPayload.InvType).toBe('07');
        expect(plainPayload.TaxType).toBe('3');
        expect(plainPayload.SpecialTaxType).toBe(8);

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.PRINT,
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
          taxType: TaxType.ZERO_TAX,
        }],
      }).then(() => {
        done();
      });
    });

    it('should issue mixed taxed invoice', (done) => {
      post.mockImplementation(async (url: string, data: unknown) => {
        const plainPayload = parseRequest(data as string);

        expect(plainPayload.Print).toBe('1');
        expect(plainPayload.InvType).toBe('07');
        expect(plainPayload.TaxType).toBe('9');
        expect(plainPayload.SpecialTaxType).toBe(0);

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.PRINT,
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }, {
          name: '鉛筆',
          quantity: 9,
          unitPrice: 6,
          taxType: TaxType.TAX_FREE,
        }],
      }).then(() => {
        done();
      });
    });

    it('should reject mixed taxed (free and zero) invoice', () => {
      post.mockImplementation(async (url: string, data: unknown) => {
        const plainPayload = parseRequest(data as string);

        expect(plainPayload.Print).toBe('1');
        expect(plainPayload.InvType).toBe('07');
        expect(plainPayload.TaxType).toBe('9');
        expect(plainPayload.SpecialTaxType).toBe(0);

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      expect(() => invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.PRINT,
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
          taxType: TaxType.ZERO_TAX,
        }, {
          name: '鉛筆',
          quantity: 9,
          unitPrice: 6,
          taxType: TaxType.TAX_FREE,
        }],
      })).rejects.toThrow();
    });

    it('should mixed taxed (taxed and special) invoice', (done) => {
      post.mockImplementation(async (url: string, data: unknown) => {
        const plainPayload = parseRequest(data as string);

        expect(plainPayload.Print).toBe('1');
        expect(plainPayload.InvType).toBe('08');
        expect(plainPayload.TaxType).toBe('4');
        expect(plainPayload.SpecialTaxType).toBe(2);

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        specialTaxCode: 2,
        carrier: InvoiceCarriers.PRINT,
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }, {
          name: '鉛筆',
          quantity: 9,
          unitPrice: 6,
          taxType: TaxType.SPECIAL,
        }],
      }).then(() => {
        done();
      });
    });

    it('should reject if no special tax code provided', () => {
      post.mockImplementation(async (url: string, data: unknown) => {
        const plainPayload = parseRequest(data as string);

        expect(plainPayload.Print).toBe('1');
        expect(plainPayload.InvType).toBe('08');
        expect(plainPayload.TaxType).toBe('4');
        expect(plainPayload.SpecialTaxType).toBe(2);

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      expect(() => invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.PRINT,
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }, {
          name: '鉛筆',
          quantity: 9,
          unitPrice: 6,
          taxType: TaxType.SPECIAL,
        }],
      })).rejects.toThrow();
    });

    it('should issue special tax item invoice', (done) => {
      post.mockImplementation(async (url: string, data: unknown) => {
        const plainPayload = parseRequest(data as string);

        expect(plainPayload.Print).toBe('1');
        expect(plainPayload.InvType).toBe('08');
        expect(plainPayload.TaxType).toBe('4');
        expect(plainPayload.SpecialTaxType).toBe(2);

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.PRINT,
        specialTaxCode: SpecialTaxCode.CLUB,
        items: [{
          name: '飲料費',
          quantity: 1,
          unitPrice: 10000,
          taxType: TaxType.SPECIAL,
        }],
      }).then(() => {
        done();
      });
    });

    it('should allow mobile only customer', (done) => {
      post.mockImplementation(async (url: string, data: unknown) => {
        const plainPayload = parseRequest(data as string);

        expect(plainPayload.CustomerEmail).toBe('');

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          mobile: '0912345678',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      }).then(() => {
        done();
      });
    });

    it('should issue moica carrier invoice', (done) => {
      post.mockImplementation(async (url: string, data: unknown) => {
        const plainPayload = parseRequest(data as string);

        expect(plainPayload.Print).toBe('0');
        expect(plainPayload.Donation).toBe('0');
        expect(plainPayload.LoveCode).toBe('');
        expect(plainPayload.CarrierType).toBe('2');
        expect(plainPayload.CarrierNum).toBe('HR12345678901234');

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.MOICA('HR12345678901234'),
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      }).then(() => {
        done();
      });
    });

    it('should love code carrier validator works', (done) => {
      const VALID_LOVE_CODE = '168001';
      const INVALID_LOVE_CODE = '98712345632';

      post.mockImplementation(async (url: string, data: unknown) => {
        if (/CheckLoveCode$/.test(url)) {
          const plainPayload = parseRequest<ECPayInvoiceLoveCodeValidateRequestBody>(data as string);

          return {
            data: generateIssueResponse<ECPayInvoiceLoveCodeValidateResponse>({
              RtnCode: 1,
              RtnMsg: '檢查成功',
              IsExist: plainPayload.LoveCode === VALID_LOVE_CODE ? 'Y' : 'N',
            }),
          };
        }

        const plainPayload = parseRequest(data as string);

        expect(plainPayload.Print).toBe('0');
        expect(plainPayload.Donation).toBe('1');
        expect(plainPayload.LoveCode).toBe(VALID_LOVE_CODE);
        expect(plainPayload.CarrierType).toBe('');
        expect(plainPayload.CarrierNum).toBe('');

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      expect(() => invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.LOVE_CODE(INVALID_LOVE_CODE),
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow().then(() => {
        invoiceGateway.issue({
          orderId: '3g49n0',
          customer: {
            name: 'tester',
            address: 'taipei',
            mobile: '0912345678',
          },
          carrier: InvoiceCarriers.LOVE_CODE(VALID_LOVE_CODE),
          items: [{
            name: '橡皮擦',
            quantity: 1,
            unitPrice: 10,
          }],
        }).then(() => {
          done();
        });
      });
    });

    it('should love code validator system error throw', (done) => {
      post.mockImplementation(async (url: string, data: unknown) => {
        return {
          data: generateIssueResponse<ECPayInvoiceLoveCodeValidateResponse>({
            RtnCode: 10000010,
            RtnMsg: '後端系統壞掉中',
            IsExist: 'N',
          }),
        };
      });

      expect(() => invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.LOVE_CODE('168001'),
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow().then(() => {
        post.mockImplementation(async (url: string, data: unknown) => {
          const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

          cipher.setAutoPadding(true);

          return {
            data: {
              MerchantID: MERCHANT_ID,
              RpHeader: {
                Timestamp: Math.round(Date.now() / 1000),
              },
              TransCode: -1,
              TransMsg: '',
              Data: [
                cipher.update(encodeURIComponent(JSON.stringify({
                  RtnCode: 1,
                  RtnMsg: '傳輸就壞了',
                  IsExist: 'N',
                })), 'utf8', 'base64'),
                cipher.final('base64'),
              ].join(''),
            },
          };
        });

        expect(() => invoiceGateway.issue({
          orderId: '3g49n0',
          customer: {
            name: 'tester',
            address: 'taipei',
            mobile: '0912345678',
          },
          carrier: InvoiceCarriers.LOVE_CODE('168001'),
          items: [{
            name: '橡皮擦',
            quantity: 1,
            unitPrice: 10,
          }],
        })).rejects.toThrow().then(() => done());
      });
    });

    it('should mobile barcode carrier validator works', (done) => {
      const VALID_MOBILE_BARCODE = '/-F-K0PR';
      const INVALID_MOBILE_BARCODE = '/-F-K0PF';

      post.mockImplementation(async (url: string, data: unknown) => {
        if (/CheckBarcode$/.test(url)) {
          const plainPayload = parseRequest<ECPayInvoiceMobileBarcodeValidateRequestBody>(data as string);

          return {
            data: generateIssueResponse<ECPayInvoiceMobileBarcodeValidateResponse>({
              RtnCode: 1,
              RtnMsg: '檢查成功',
              IsExist: plainPayload.BarCode === VALID_MOBILE_BARCODE ? 'Y' : 'N',
            }),
          };
        }

        const plainPayload = parseRequest(data as string);

        expect(plainPayload.Print).toBe('0');
        expect(plainPayload.Donation).toBe('0');
        expect(plainPayload.LoveCode).toBe('');
        expect(plainPayload.CarrierType).toBe('3');
        expect(plainPayload.CarrierNum).toBe(VALID_MOBILE_BARCODE);

        const invoiceDate = '2022-06-17+14:29:59';

        const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

        cipher.setAutoPadding(true);

        return {
          data: generateIssueResponse({
            RtnCode: 1,
            RtnMsg: '開立發票成功',
            InvoiceNo: 'YA88888888',
            InvoiceDate: invoiceDate,
            RandomNumber: '2358',
          }),
        };
      });

      expect(() => invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.MOBILE(INVALID_MOBILE_BARCODE),
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow().then(() => {
        invoiceGateway.issue({
          orderId: '3g49n0',
          customer: {
            mobile: '0912345678',
          },
          carrier: InvoiceCarriers.MOBILE(VALID_MOBILE_BARCODE),
          items: [{
            name: '橡皮擦',
            quantity: 1,
            unitPrice: 10,
          }],
        }).then(() => {
          done();
        });
      });
    });

    it('should mobile barcode validator system error throw', (done) => {
      post.mockImplementation(async (url: string, data: unknown) => {
        return {
          data: generateIssueResponse<ECPayInvoiceMobileBarcodeValidateResponse>({
            RtnCode: 10000010,
            RtnMsg: '後端系統壞掉中',
            IsExist: 'N',
          }),
        };
      });

      expect(() => invoiceGateway.issue({
        orderId: '3g49n0',
        customer: {
          name: 'tester',
          address: 'taipei',
          mobile: '0912345678',
        },
        carrier: InvoiceCarriers.MOBILE('168001'),
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow().then(() => {
        post.mockImplementation(async (url: string, data: unknown) => {
          const cipher = createCipheriv('aes-128-cbc', AES_KEY, AES_IV);

          cipher.setAutoPadding(true);

          return {
            data: {
              MerchantID: MERCHANT_ID,
              RpHeader: {
                Timestamp: Math.round(Date.now() / 1000),
              },
              TransCode: -1,
              TransMsg: '',
              Data: [
                cipher.update(encodeURIComponent(JSON.stringify({
                  RtnCode: 1,
                  RtnMsg: '傳輸就壞了',
                  IsExist: 'N',
                })), 'utf8', 'base64'),
                cipher.final('base64'),
              ].join(''),
            },
          };
        });

        expect(() => invoiceGateway.issue({
          orderId: '3g49n0',
          customer: {
            name: 'tester',
            address: 'taipei',
            mobile: '0912345678',
          },
          carrier: InvoiceCarriers.MOBILE('168001'),
          items: [{
            name: '橡皮擦',
            quantity: 1,
            unitPrice: 10,
          }],
        })).rejects.toThrow().then(() => done());
      });
    });

    it('should reject invalid options', () => {
      expect(() => invoiceGateway.issue({
        orderId: '3g49n0#',
        customer: {
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(16).toString('hex'),
        customer: {
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: '',
        customer: {
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        vatNumber: '1204',
        customer: {
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        customer: {
          id: '1234567F9012_45678901',
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        customer: {
          id: '1234567890123456789%',
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        vatNumber: '54366906',
        customer: {
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        customer: {},
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
        customer: {
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
        customer: {
          name: 'test',
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
        customer: {
          address: 'taiwan',
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        customer: {
          email: 'testfake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        customer: {
          email: 'test@fake.com',
          mobile: 'fake',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        vatNumber: '54366906',
        carrier: {
          type: InvoiceCarrierType.MEMBER,
          code: 'member_id',
        },
        customer: {
          name: 'Rytass Co., Ltd.',
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        carrier: {
          type: InvoiceCarrierType.MOICA,
          code: 'fake_id',
        },
        customer: {
          name: 'Rytass Co., Ltd.',
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 10,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        customer: {
          email: 'test@fake.com',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 0,
        }],
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        orderId: randomBytes(15).toString('hex'),
        customer: {
          mobile: '0900000000',
        },
        items: [{
          name: '橡皮擦',
          quantity: 1,
          unitPrice: 0,
        }],
      })).rejects.toThrow();
    });
  });
});
