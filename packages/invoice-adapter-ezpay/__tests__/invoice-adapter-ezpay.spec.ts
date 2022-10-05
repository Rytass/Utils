/**
 * @jest-environment node
 */

import { randomBytes } from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import { createDecipheriv, createCipheriv } from 'crypto';
import { parse } from 'parse-multipart-data';
import { CustomsMark, InvoiceCarrierType, TaxType } from '@rytass/invoice';
import { EZPayBaseUrls, EZPayInvoiceGateway, EZPayInvoiceIssuePayload } from '../src';

const DEFAULT_AES_IV = 'CrJMQLwDF6zKOeaP';
const DEFAULT_AES_KEY = 'yoRs5AfTfAWe9HI4DlEYKRorr9YvV3Kr';
const DEFAULT_MERCHANT_ID = '34818970';

const AES_IV = randomBytes(8).toString('hex');
const AES_KEY = randomBytes(16).toString('hex');
const MERCHANT_ID = '9999999';

const getMobileValidationResult = (code: string, isPass = false) => {
  const cipher = createCipheriv('aes-256-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

  cipher.setAutoPadding(false);

  return [
    cipher.update(`CellphoneBarcode=${encodeURIComponent(code)}&IsExist=${isPass ? 'Y' : 'N'}`.padEnd(64, '\x1b'), 'utf8', 'hex'),
    cipher.final('hex'),
  ].join('');
};

const getLoveCodeValidationResult = (code: string, isPass = false) => {
  const cipher = createCipheriv('aes-256-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

  cipher.setAutoPadding(false);

  return [
    cipher.update(`LoveCode=${encodeURIComponent(code)}&IsExist=${isPass ? 'Y' : 'N'}`.padEnd(64, '\x1b'), 'utf8', 'hex'),
    cipher.final('hex'),
  ].join('');
};

const getDefaultResponse = (orderNo: string) => ({
  data: {
    Message: '發票開立成功',
    Status: 'SUCCESS',
    Result: JSON.stringify({
      CheckCode: '',
      MerchantID: DEFAULT_MERCHANT_ID,
      MerchantOrderNo: orderNo,
      InvoiceNumber: 'XX00000009',
      TotalAmt: 44,
      InvoiceTransNo: '22100516414987644',
      RandomNum: '1297',
      CreateTime: '2022-10-05 16:41:49',
      BarCode: '11110XX000000031297',
      QRcodeL: '**',
      QRcodeR: '**',
    }),
  },
});

function parseFormData(formData: FormData, aesKey = DEFAULT_AES_KEY, aseIv = DEFAULT_AES_IV): EZPayInvoiceIssuePayload {
  const payloadArray = parse(formData.getBuffer(), formData.getBoundary());

  const payload = payloadArray.reduce((vars, field) => ({
    ...vars,
    [field.name as string]: field.data.toString('utf8'),
  }), {}) as {
    MerchantID_: string;
    PostData_: string;
  };

  const decipher = createDecipheriv('aes-256-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

  const plainText = [
    decipher.update(payload.PostData_, 'hex', 'utf8'),
    decipher.final('utf8'),
  ].join('');

  return plainText.split(/&/)
    .reduce((vars, item) => {
      const [key, value] = item.split(/=/);

      return {
        ...vars,
        [key]: decodeURIComponent(value),
      };
    }, {}) as EZPayInvoiceIssuePayload;
}

describe('EZPayInvoiceGateway', () => {
  describe('default options', () => {
    const post = jest.spyOn(axios, 'post');
    const invoiceGateway = new EZPayInvoiceGateway();

    beforeAll(() => {
      post.mockImplementation(async (url: string, data: any) => {
        const formData = data as FormData;

        const payloadArray = parse(formData.getBuffer(), formData.getBoundary());

        const payload = payloadArray.reduce((vars, field) => ({
          ...vars,
          [field.name as string]: field.data.toString('utf8'),
        }), {}) as {
          MerchantID_: string;
          PostData_: string;
        };

        const decipher = createDecipheriv('aes-256-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

        const plainText = [
          decipher.update(payload.PostData_, 'hex', 'utf8'),
          decipher.final('utf8'),
        ].join('');

        const params = plainText.split(/&/)
          .reduce((vars, item) => {
            const [key, value] = item.split(/=/);

            return {
              ...vars,
              [key]: decodeURIComponent(value),
            };
          }, {}) as EZPayInvoiceIssuePayload;

        return {
          data: {
            Message: '發票開立成功',
            Status: 'SUCCESS',
            Result: JSON.stringify({
              CheckCode: '',
              MerchantID: payload.MerchantID_,
              MerchantOrderNo: params.MerchantOrderNo,
              InvoiceNumber: 'XX00000003',
              TotalAmt: 44,
              InvoiceTransNo: '22100516414987644',
              RandomNum: '1297',
              CreateTime: '2022-10-05 16:41:49',
              BarCode: '11110XX000000031297',
              QRcodeL: '**',
              QRcodeR: '**',
            }),
          },
        };
      });
    });

    it('should issue with default key', async () => {
      const invoice = await invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }],
        buyerName: 'Tester',
        buyerEmail: 'user@rytass.com',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      });

      expect(invoice.invoiceNumber).toBe('XX00000003');
    });

    afterAll(() => {
      jest.clearAllMocks();
    });
  });

  describe('pass custom options', () => {
    const post = jest.spyOn(axios, 'post');
    const invoiceGateway = new EZPayInvoiceGateway({
      hashIv: AES_IV,
      hashKey: AES_KEY,
      merchantId: MERCHANT_ID,
      baseUrl: EZPayBaseUrls.PRODUCTION,
    });

    beforeAll(() => {
      post.mockImplementation(async (url: string, data: any) => {
        expect(url).toBe(`${EZPayBaseUrls.PRODUCTION}/Api/invoice_issue`);

        const formData = data as FormData;

        const payloadArray = parse(formData.getBuffer(), formData.getBoundary());

        const payload = payloadArray.reduce((vars, field) => ({
          ...vars,
          [field.name as string]: field.data.toString('utf8'),
        }), {}) as {
          MerchantID_: string;
          PostData_: string;
        };

        const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

        const plainText = [
          decipher.update(payload.PostData_, 'hex', 'utf8'),
          decipher.final('utf8'),
        ].join('');

        const params = plainText.split(/&/)
          .reduce((vars, item) => {
            const [key, value] = item.split(/=/);

            return {
              ...vars,
              [key]: decodeURIComponent(value),
            };
          }, {}) as EZPayInvoiceIssuePayload;

        return {
          data: {
            Message: '發票開立成功',
            Status: 'SUCCESS',
            Result: JSON.stringify({
              CheckCode: '',
              MerchantID: payload.MerchantID_,
              MerchantOrderNo: params.MerchantOrderNo,
              InvoiceNumber: 'XX00000009',
              TotalAmt: 44,
              InvoiceTransNo: '22100516414987644',
              RandomNum: '1297',
              CreateTime: '2022-10-05 16:41:49',
              BarCode: '11110XX000000031297',
              QRcodeL: '**',
              QRcodeR: '**',
            }),
          },
        };
      });
    });

    it('should call api with custom options', async () => {
      const invoice = await invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }],
        buyerName: 'Tester',
        buyerEmail: 'user@rytass.com',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      });

      expect(invoice.invoiceNumber).toBe('XX00000009');
    });

    afterAll(() => {
      jest.clearAllMocks();
    });
  });

  describe('issue', () => {
    const post = jest.spyOn(axios, 'post');
    const invoiceGateway = new EZPayInvoiceGateway();

    beforeAll(() => {
      post.mockImplementation(async (url: string, data: any) => {
        const formData = data as FormData;

        const payloadArray = parse(formData.getBuffer(), formData.getBoundary());

        const payload = payloadArray.reduce((vars, field) => ({
          ...vars,
          [field.name as string]: field.data.toString('utf8'),
        }), {}) as {
          MerchantID_: string;
          PostData_: string;
        };

        const decipher = createDecipheriv('aes-256-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

        const plainText = [
          decipher.update(payload.PostData_, 'hex', 'utf8'),
          decipher.final('utf8'),
        ].join('');

        const params = plainText.split(/&/)
          .reduce((vars, item) => {
            const [key, value] = item.split(/=/);

            return {
              ...vars,
              [key]: decodeURIComponent(value),
            };
          }, {}) as EZPayInvoiceIssuePayload;

        return {
          data: {
            Message: '發票開立成功',
            Status: 'SUCCESS',
            Result: JSON.stringify({
              CheckCode: '',
              MerchantID: payload.MerchantID_,
              MerchantOrderNo: params.MerchantOrderNo,
              InvoiceNumber: 'XX00000003',
              TotalAmt: 44,
              InvoiceTransNo: '22100516414987644',
              RandomNum: '1297',
              CreateTime: '2022-10-05 16:41:49',
              BarCode: '11110XX000000031297',
              QRcodeL: '**',
              QRcodeR: '**',
            }),
          },
        };
      });
    });

    it('should throw when orderId not valid', () => {
      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }, {
          name: '鉛筆',
          unitPrice: 8,
          quantity: 3,
        }],
        buyerName: 'Tester',
        buyerEmail: 'user@rytass.com',
        orderId: '2022100500004^',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      })).rejects.toThrow();

      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }, {
          name: '鉛筆',
          unitPrice: 8,
          quantity: 3,
        }],
        buyerName: 'Tester',
        buyerEmail: 'user@rytass.com',
        orderId: '20221005000047401720213472',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      })).rejects.toThrow();
    });

    it('should throw when vat number invalid', () => {
      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }, {
          name: '鉛筆',
          unitPrice: 8,
          quantity: 3,
        }],
        vatNumber: '400100000',
        buyerName: 'Tester',
        buyerEmail: 'user@rytass.com',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      })).rejects.toThrow();
    });

    it('should throw when email invalid', () => {
      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }, {
          name: '鉛筆',
          unitPrice: 8,
          quantity: 3,
        }],
        buyerName: 'Tester',
        buyerEmail: 'aaaa.com',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      })).rejects.toThrow();
    });

    it('should throw when issue B2B invoice with carrier', () => {
      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }, {
          name: '鉛筆',
          unitPrice: 8,
          quantity: 3,
        }],
        vatNumber: '54366906',
        buyerName: 'Tester',
        buyerEmail: 'user@rytass.com',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.MOBILE,
          code: 'FAKE',
        },
      })).rejects.toThrow();
    });

    it('should throw when buyer invalid', () => {
      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }, {
          name: '鉛筆',
          unitPrice: 8,
          quantity: 3,
        }],
        buyerEmail: 'user@rytass.com',
        orderId: '2022100500004',
        buyerName: '123456789012345678901234567890aaa',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      })).rejects.toThrow();
    });

    it('should throw when use platform carrier without email', () => {
      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }, {
          name: '鉛筆',
          unitPrice: 8,
          quantity: 3,
        }],
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PLATFORM,
          code: 'FAKE',
        },
      })).rejects.toThrow();
    });

    it('should throw when taxType is Special', () => {
      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.SPECIAL,
        }, {
          name: '鉛筆',
          unitPrice: 8,
          quantity: 3,
          taxType: TaxType.SPECIAL,
        }],
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      })).rejects.toThrow();
    });

    it('should throw when mixed tax type and issue B2B invoice', () => {
      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.TAX_FREE,
        }, {
          name: '鉛筆',
          unitPrice: 8,
          quantity: 3,
          taxType: TaxType.TAXED,
        }],
        vatNumber: '54366906',
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      })).rejects.toThrow();
    });

    it('should throw when moica is invalid', () => {
      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.TAX_FREE,
        }, {
          name: '鉛筆',
          unitPrice: 8,
          quantity: 3,
          taxType: TaxType.TAXED,
        }],
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.MOICA,
          code: '18090918203',
        },
      })).rejects.toThrow();
    });

    it('should throw when total amount is zero', () => {
      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 0,
          quantity: 2,
          taxType: TaxType.TAX_FREE,
        }],
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      })).rejects.toThrow();
    });

    it('should issue B2B Invoice', async () => {
      const invoice = await invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.TAX_FREE,
        }],
        vatNumber: '54366906',
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      });

      expect(invoice.invoiceNumber).toBe('XX00000003');
    });

    it('should issue B2C Invoice with platform carrier', async () => {
      const invoice = await invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.TAX_FREE,
        }],
        buyerEmail: 'user@rytass.com',
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PLATFORM,
          code: '54366906',
        },
      });

      expect(invoice.invoiceNumber).toBe('XX00000003');
    });

    afterAll(() => {
      jest.clearAllMocks();
    });
  });

  describe('issue params check', () => {
    const post = jest.spyOn(axios, 'post');
    const invoiceGateway = new EZPayInvoiceGateway();

    it('should use vatNumber when buyer name length large than 61 and B2B invoice', async () => {
      post.mockImplementationOnce(async (url: string, data: any) => {
        const params = parseFormData(data as FormData, DEFAULT_AES_KEY, DEFAULT_AES_IV);

        expect(params.BuyerName).toBe('54366906');

        return getDefaultResponse(params.MerchantOrderNo);
      });

      await invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.TAX_FREE,
        }],
        vatNumber: '54366906',
        buyerName: '123456789012345678901234567890123456789012345678901234567890gg',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      });
    });

    it('should represent on love code carrier', async () => {
      post.mockImplementationOnce(async (url: string, data: any) => {
        if (url.match(/checkLoveCode$/)) {
          return {
            data: {
              Status: 'SUCCESS',
              Version: '1.0',
              Result: getLoveCodeValidationResult('99987', true),
              MerchantID: DEFAULT_MERCHANT_ID,
              CheckCode: '18E7C9A4294C3C19E854C83AAEEBF3269A2F5DC370885108814F360AE172FCD8',
              APIID: 'loveCodeCheck',
              Message: '查詢成功',
            },
          };
        }

        const params = parseFormData(data as FormData, DEFAULT_AES_KEY, DEFAULT_AES_IV);

        expect(params.LoveCode).toBe('99987');

        return getDefaultResponse(params.MerchantOrderNo);
      });

      await invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.TAX_FREE,
        }],
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.LOVE_CODE,
          code: '99987',
        },
      });
    });

    it('should represent custom marks', async () => {
      post.mockImplementationOnce(async (url: string, data: any) => {
        const params = parseFormData(data as FormData, DEFAULT_AES_KEY, DEFAULT_AES_IV);

        expect(params.CustomsClearance).toBe('2');

        return getDefaultResponse(params.MerchantOrderNo);
      });

      await invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.ZERO_TAX,
        }],
        customsMark: CustomsMark.YES,
        buyerName: 'Tester',
        buyerEmail: 'user@rytass.com',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PLATFORM,
          code: '99987',
        },
      });

      post.mockImplementationOnce(async (url: string, data: any) => {
        const params = parseFormData(data as FormData, DEFAULT_AES_KEY, DEFAULT_AES_IV);

        expect(params.CustomsClearance).toBe('1');

        return getDefaultResponse(params.MerchantOrderNo);
      });

      await invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.ZERO_TAX,
        }],
        customsMark: CustomsMark.NO,
        buyerName: 'Tester',
        buyerEmail: 'user@rytass.com',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PLATFORM,
          code: '99987',
        },
      });
    });

    it('should represent mixed tax type', async () => {
      post.mockImplementationOnce(async (url: string, data: any) => {
        const params = parseFormData(data as FormData, DEFAULT_AES_KEY, DEFAULT_AES_IV);

        expect(params.AmtSales).toBe('13');
        expect(params.AmtZero).toBe('');
        expect(params.AmtFree).toBe('20');

        return getDefaultResponse(params.MerchantOrderNo);
      });

      await invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.TAX_FREE,
        }, {
          name: '筆芯',
          unitPrice: 2,
          quantity: 7,
          taxType: TaxType.TAXED,
        }],
        buyerEmail: 'user@rytass.com',
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PLATFORM,
          code: '99987',
        },
      });

      post.mockImplementationOnce(async (url: string, data: any) => {
        const params = parseFormData(data as FormData, DEFAULT_AES_KEY, DEFAULT_AES_IV);

        expect(params.AmtSales).toBe('13');
        expect(params.AmtZero).toBe('20');
        expect(params.AmtFree).toBe('');

        return getDefaultResponse(params.MerchantOrderNo);
      });

      await invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.ZERO_TAX,
        }, {
          name: '筆芯',
          unitPrice: 2,
          quantity: 7,
          taxType: TaxType.SPECIAL,
        }],
        buyerName: 'Tester',
        buyerEmail: 'user@rytass.com',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PLATFORM,
          code: '99987',
        },
      });
    });

    it('should represent on special tax rate', async () => {
      post.mockImplementationOnce(async (url: string, data: any) => {
        const params = parseFormData(data as FormData, DEFAULT_AES_KEY, DEFAULT_AES_IV);

        expect(params.Amt).toBe('18');

        return getDefaultResponse(params.MerchantOrderNo);
      });

      await invoiceGateway.issue({
        specialTaxPercentage: 13,
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }],
        buyerName: 'Tester',
        buyerEmail: 'user@rytass.com',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PLATFORM,
          code: '99987',
        },
      });
    });

    it('should issue with mobile carrier', async () => {
      post.mockImplementation(async (url: string, data: any) => {
        if (url.match(/checkBarCode$/)) {
          return {
            data: {
              Status: 'SUCCESS',
              Version: '1.0',
              Result: getMobileValidationResult('/-F-K0DR', true),
              MerchantID: DEFAULT_MERCHANT_ID,
              CheckCode: '18E7C9A4294C3C19E854C83AAEEBF3269A2F5DC370885108814F360AE172FCD8',
              APIID: 'barCodeCheck',
              Message: '查詢成功',
            },
          };
        }

        const params = parseFormData(data as FormData, DEFAULT_AES_KEY, DEFAULT_AES_IV);

        expect(params.CarrierType).toBe('0');
        expect(params.CarrierNum).toBe('/-F-K0DR');

        return getDefaultResponse(params.MerchantOrderNo);
      });

      await invoiceGateway.issue({
        specialTaxPercentage: 13,
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }],
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.MOBILE,
          code: '/-F-K0DR',
        },
      });
    });

    it('should issue with moica carrier', async () => {
      post.mockImplementationOnce(async (url: string, data: any) => {
        const params = parseFormData(data as FormData, DEFAULT_AES_KEY, DEFAULT_AES_IV);

        expect(params.CarrierType).toBe('1');
        expect(params.CarrierNum).toBe('HS01174901724994');

        return getDefaultResponse(params.MerchantOrderNo);
      });

      await invoiceGateway.issue({
        specialTaxPercentage: 13,
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }],
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.MOICA,
          code: 'HS01174901724994',
        },
      });
    });

    it('should issue with no carrier for B2B invoice', async () => {
      post.mockImplementationOnce(async (url: string, data: any) => {
        const params = parseFormData(data as FormData, DEFAULT_AES_KEY, DEFAULT_AES_IV);

        expect(params.PrintFlag).toBe('Y');
        expect(params.CarrierType).toBe('');

        return getDefaultResponse(params.MerchantOrderNo);
      });

      await invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }],
        vatNumber: '54366906',
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      });
    });

    it('should throw error on server reject', () => {
      post.mockImplementationOnce(async (url: string, data: any) => {
        const params = parseFormData(data as FormData, DEFAULT_AES_KEY, DEFAULT_AES_IV);

        expect(params.PrintFlag).toBe('Y');
        expect(params.CarrierType).toBe('');

        return {
          data: {
            Status: 'KEY10004',
            Message: '資料不齊全',
            Result: '',
          },
        };
      });

      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }],
        vatNumber: '54366906',
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.PRINT,
        },
      })).rejects.toThrow();
    });

    it('should throw error when mobile validation service down', () => {
      post.mockImplementation(async (url: string, data: any) => {
        if (url.match(/checkBarCode$/)) {
          return {
            data: {
              Status: 'IAI10006',
              Version: '1.0',
              Result: '',
              MerchantID: DEFAULT_MERCHANT_ID,
              CheckCode: '18E7C9A4294C3C19E854C83AAEEBF3269A2F5DC370885108814F360AE172FCD8',
              APIID: 'barCodeCheck',
              Message: '異常終止',
            },
          };
        }
      });

      expect(() => invoiceGateway.issue({
        specialTaxPercentage: 13,
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }],
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.MOBILE,
          code: '/-F-K0DR',
        },
      })).rejects.toThrow();
    });

    it('should throw error when mobile barcode not valid', () => {
      post.mockImplementation(async (url: string, data: any) => {
        if (url.match(/checkBarCode$/)) {
          return {
            data: {
              Status: 'SUCCESS',
              Version: '1.0',
              Result: getMobileValidationResult('/-F-K0DQ', false),
              MerchantID: DEFAULT_MERCHANT_ID,
              CheckCode: '18E7C9A4294C3C19E854C83AAEEBF3269A2F5DC370885108814F360AE172FCD8',
              APIID: 'barCodeCheck',
              Message: '查詢成功',
            },
          };
        }
      });

      expect(() => invoiceGateway.issue({
        specialTaxPercentage: 13,
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }],
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.MOBILE,
          code: '/-F-K0DQ',
        },
      })).rejects.toThrow();
    });

    it('should throw error when love code validation service down', async () => {
      post.mockImplementationOnce(async (url: string, data: any) => {
        if (url.match(/checkLoveCode$/)) {
          return {
            data: {
              Status: 'IAI10006',
              Version: '1.0',
              Result: '',
              MerchantID: DEFAULT_MERCHANT_ID,
              CheckCode: '18E7C9A4294C3C19E854C83AAEEBF3269A2F5DC370885108814F360AE172FCD8',
              APIID: 'loveCodeCheck',
              Message: '異常終止',
            },
          };
        }
      });

      expect(() => invoiceGateway.issue({
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
          taxType: TaxType.TAX_FREE,
        }],
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.LOVE_CODE,
          code: '99987',
        },
      })).rejects.toThrow();
    });

    it('should throw error when love code not valid', () => {
      post.mockImplementation(async (url: string, data: any) => {
        if (url.match(/checkLoveCode$/)) {
          return {
            data: {
              Status: 'SUCCESS',
              Version: '1.0',
              Result: getLoveCodeValidationResult('99988', false),
              MerchantID: DEFAULT_MERCHANT_ID,
              CheckCode: '18E7C9A4294C3C19E854C83AAEEBF3269A2F5DC370885108814F360AE172FCD8',
              APIID: 'loveCodeCheck',
              Message: '查詢成功',
            },
          };
        }
      });

      expect(() => invoiceGateway.issue({
        specialTaxPercentage: 13,
        items: [{
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        }],
        buyerName: 'Tester',
        orderId: '2022100500004',
        carrier: {
          type: InvoiceCarrierType.LOVE_CODE,
          code: '99988',
        },
      })).rejects.toThrow();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });
  });
});
