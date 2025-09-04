/**
 * @jest-environment node
 */

import axios from 'axios';
import FormData from 'form-data';
import { createDecipheriv, createHash } from 'crypto';
import { parse } from 'parse-multipart-data';
import { DateTime } from 'luxon';
import {
  EZPayBaseUrls,
  EZPayInvoice,
  EZPayInvoiceAllowancePayload,
  EZPayInvoiceGateway,
  EZPayInvoiceInvalidAllowancePayload,
  InvoiceAllowanceState,
  InvoiceCarrierType,
  TaxType,
} from '../src';
import { ERROR_INVOICE_REMAINING_AMOUNT_NOT_ENOUGH } from '../src/constants';

const AES_IV = 'gmY2MPN8PHFvA7KR';
const AES_KEY = 'cNg3wIe8PkCVcqb37RY0LFbf00FgrNXg';
const MERCHANT_ID = '31090553';

function getResponseCheckCode<T extends Record<string, any>>(response: T): string {
  const encodedData = Object.entries(response)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return createHash('sha256').update(`HashIV=${AES_IV}&${encodedData}&HashKey=${AES_KEY}`).digest('hex').toUpperCase();
}

const INVOICE_REMAINING_AMOUNT: Record<string, number> = {};
const invalidAllowanceSet = new Set();

describe('EZPayInvoiceGateway:Allowance', () => {
  const post = jest.spyOn(axios, 'post');

  const invoiceGateway = new EZPayInvoiceGateway({
    hashIv: AES_IV,
    hashKey: AES_KEY,
    merchantId: MERCHANT_ID,
    baseUrl: EZPayBaseUrls.DEVELOPMENT,
  });

  const FAKE_INVOICE_NUMBER = 'JJ00050096';
  const FAKE_RANDOM_CODE = '9527';
  const FAKE_PLATFORM_ID = '22122618222889038';
  const FAKE_ORDER_ID = '202212260100401';
  const SHOULD_THROW_INVOICE_NUMBER = 'JJ00050097';
  const SHOULD_THROW_ALLOWANCE_REASON = 'THROWWWW';

  beforeAll(() => {
    post.mockImplementation(async (url: string, data: any) => {
      const formData = data as FormData;

      const payloadArray = parse(formData.getBuffer(), formData.getBoundary());

      const payload = payloadArray.reduce(
        (vars, field) => ({
          ...vars,
          [field.name as string]: field.data.toString('utf8'),
        }),
        {},
      ) as {
        MerchantID_: string;
        PostData_: string;
      };

      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      const plainText = [decipher.update(payload.PostData_, 'hex', 'utf8'), decipher.final('utf8')].join('');

      if (/allowance_issue$/.test(url)) {
        const params = plainText.split(/&/).reduce((vars, item) => {
          const [key, value] = item.split(/=/);

          return {
            ...vars,
            [key]: decodeURIComponent(value),
          };
        }, {}) as EZPayInvoiceAllowancePayload;

        const remaingAmount = INVOICE_REMAINING_AMOUNT[params.InvoiceNo] || 0;

        if (params.BuyerEmail) {
          expect(true).toBeTruthy();
        }

        if (remaingAmount < params.TotalAmt) {
          return {
            data: {
              Status: ERROR_INVOICE_REMAINING_AMOUNT_NOT_ENOUGH,
              Message: '折讓的金額不能大於發票可折讓金額',
              Result: [],
            },
          };
        }

        INVOICE_REMAINING_AMOUNT[params.InvoiceNo] = remaingAmount - params.TotalAmt;

        return {
          data: {
            Message: '發票折讓開立成功',
            Status: 'SUCCESS',
            Result: JSON.stringify({
              CheckCode: getResponseCheckCode({
                InvoiceTransNo: FAKE_PLATFORM_ID,
                MerchantID: SHOULD_THROW_INVOICE_NUMBER === params.InvoiceNo ? 'INVALID_MERCHANT_ID' : MERCHANT_ID,
                MerchantOrderNo: FAKE_ORDER_ID,
                RandomNum: FAKE_RANDOM_CODE,
                TotalAmt: 20,
              }),
              AllowanceNo: `A${Math.round(Date.now() / 1000)}`,
              InvoiceNumber: FAKE_INVOICE_NUMBER,
              MerchantID: MERCHANT_ID,
              MerchantOrderNo: FAKE_ORDER_ID,
              AllowanceAmt: params.TotalAmt,
              RemainAmt: INVOICE_REMAINING_AMOUNT[params.InvoiceNo] || 0,
            }),
          },
        };
      }

      const params = plainText.split(/&/).reduce((vars, item) => {
        const [key, value] = item.split(/=/);

        return {
          ...vars,
          [key]: decodeURIComponent(value),
        };
      }, {}) as EZPayInvoiceInvalidAllowancePayload;

      if (invalidAllowanceSet.has(params.AllowanceNo)) {
        return {
          data: {
            Status: 'LIB10005',
            Message: '發票已作廢或未開立(無法進行折讓)',
            Result: [],
          },
        };
      }

      invalidAllowanceSet.add(params.AllowanceNo);

      return {
        data: {
          Message: '作廢折讓成功',
          Status: 'SUCCESS',
          Result: JSON.stringify({
            CheckCode: getResponseCheckCode({
              InvoiceTransNo: FAKE_PLATFORM_ID,
              MerchantID: SHOULD_THROW_ALLOWANCE_REASON === params.InvalidReason ? 'INVALID_MERCHANT_ID' : MERCHANT_ID,
              MerchantOrderNo: FAKE_ORDER_ID,
              RandomNum: FAKE_RANDOM_CODE,
              TotalAmt: 20,
            }),
            AllowanceNo: params.AllowanceNo,
            CreateTime: DateTime.now().toFormat('yyyy/MM/dd HH:mm:ss'),
            MerchantID: MERCHANT_ID,
          }),
        },
      };
    });
  });

  it('should allowance an invoice', async () => {
    INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

    const mockInvoice = new EZPayInvoice({
      items: [
        {
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        },
      ],
      issuedOn: new Date(),
      invoiceNumber: FAKE_INVOICE_NUMBER,
      randomCode: FAKE_RANDOM_CODE,
      platformId: FAKE_PLATFORM_ID,
      orderId: FAKE_ORDER_ID,
      taxType: TaxType.TAXED,
    });

    expect(mockInvoice.allowances.length).toBe(0);

    const allowanced = await invoiceGateway.allowance(mockInvoice, [
      {
        name: '橡皮擦',
        unitPrice: 5,
        quantity: 1,
      },
    ]);

    expect(allowanced).toBe(mockInvoice);
    expect(allowanced.nowAmount).toBe(15);
    expect(allowanced.allowances.length).toBe(1);
    expect(allowanced.allowances[0].allowancePrice).toBe(5);

    const allowanced2 = await invoiceGateway.allowance(mockInvoice, [
      {
        name: '橡皮擦',
        unitPrice: 10,
        quantity: 1,
      },
    ]);

    expect(allowanced2).toBe(allowanced);
    expect(allowanced2.nowAmount).toBe(5);
    expect(allowanced2.allowances.length).toBe(2);
    expect(allowanced2.allowances[1].allowancePrice).toBe(10);
  });

  describe('Not enough allowance will throw error', () => {
    it('should throw on offline check', () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
      });

      expect(
        invoiceGateway.allowance(mockInvoice, [
          {
            name: '橡皮擦',
            unitPrice: 30,
            quantity: 1,
          },
        ]),
      ).rejects.toThrow();
    });

    it('should throw error when online check', () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 10;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
      });

      expect(() =>
        invoiceGateway.allowance(mockInvoice, [
          {
            name: '橡皮擦',
            unitPrice: 15,
            quantity: 1,
          },
        ]),
      ).rejects.toThrow();
    });
  });

  describe('Invalid allowance', () => {
    it('should allowance invalid', async () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
      });

      await invoiceGateway.allowance(mockInvoice, [
        {
          name: '橡皮擦',
          unitPrice: 8,
          quantity: 1,
        },
      ]);

      expect(mockInvoice.allowances[0].status).toBe(InvoiceAllowanceState.ISSUED);
      expect(mockInvoice.nowAmount).toBe(12);

      await invoiceGateway.invalidAllowance(mockInvoice.allowances[0]);

      expect(mockInvoice.allowances[0].status).toBe(InvoiceAllowanceState.INVALID);
      expect(mockInvoice.nowAmount).toBe(20);
    });

    it('should reject invalid when status not correct (offline)', async () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
      });

      await invoiceGateway.allowance(mockInvoice, [
        {
          name: '橡皮擦',
          unitPrice: 8,
          quantity: 1,
        },
      ]);

      await invoiceGateway.invalidAllowance(mockInvoice.allowances[0]);

      expect(invoiceGateway.invalidAllowance(mockInvoice.allowances[0])).rejects.toThrow();
    });

    it('should reject invalid when status not correct (online)', async () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
      });

      await invoiceGateway.allowance(mockInvoice, [
        {
          name: '橡皮擦',
          unitPrice: 8,
          quantity: 1,
        },
      ]);

      await invoiceGateway.invalidAllowance(mockInvoice.allowances[0]);

      mockInvoice.allowances[0].status = InvoiceAllowanceState.ISSUED;

      expect(() => invoiceGateway.invalidAllowance(mockInvoice.allowances[0])).rejects.toThrow();
    });

    afterEach(() => {
      invalidAllowanceSet.clear();
    });
  });

  describe('Allowance mixed tax type invoice', () => {
    it('should allowance a mixed tax invoice taxed item', async () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.MIXED,
      });

      const allowanced = await invoiceGateway.allowance(
        mockInvoice,
        [
          {
            name: '橡皮擦',
            unitPrice: 8,
            quantity: 1,
          },
        ],
        {
          taxType: TaxType.TAXED,
        },
      );

      expect(allowanced).toBe(mockInvoice);
      expect(allowanced.nowAmount).toBe(12);
      expect(allowanced.allowances.length).toBe(1);
      expect(allowanced.allowances[0].allowancePrice).toBe(8);
    });

    it('should allowance a mixed tax invoice tax-free item', async () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.MIXED,
      });

      const allowanced = await invoiceGateway.allowance(
        mockInvoice,
        [
          {
            name: '橡皮擦',
            unitPrice: 8,
            quantity: 1,
          },
        ],
        {
          taxType: TaxType.TAX_FREE,
        },
      );

      expect(allowanced).toBe(mockInvoice);
      expect(allowanced.nowAmount).toBe(12);
      expect(allowanced.allowances.length).toBe(1);
      expect(allowanced.allowances[0].allowancePrice).toBe(8);
    });

    it('should allowance a mixed tax invoice tax-zero item', async () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.MIXED,
      });

      const allowanced = await invoiceGateway.allowance(
        mockInvoice,
        [
          {
            name: '橡皮擦',
            unitPrice: 8,
            quantity: 1,
          },
        ],
        {
          taxType: TaxType.ZERO_TAX,
        },
      );

      expect(allowanced).toBe(mockInvoice);
      expect(allowanced.nowAmount).toBe(12);
      expect(allowanced.allowances.length).toBe(1);
      expect(allowanced.allowances[0].allowancePrice).toBe(8);
    });

    it('should reject allowance a mixed tax invoice if not specific tax type', async () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.MIXED,
      });

      expect(() =>
        invoiceGateway.allowance(mockInvoice, [
          {
            name: '橡皮擦',
            unitPrice: 8,
            quantity: 1,
          },
        ]),
      ).rejects.toThrow();
    });
  });

  describe('Misc', () => {
    afterEach(() => {
      invalidAllowanceSet.clear();
    });

    it('should throw error when check code invalid [allowance]', async () => {
      INVOICE_REMAINING_AMOUNT[SHOULD_THROW_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦 II',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: SHOULD_THROW_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
      });

      expect(() =>
        invoiceGateway.allowance(mockInvoice, [
          {
            name: '橡皮擦',
            unitPrice: 8,
            quantity: 1,
          },
        ]),
      ).rejects.toThrow();
    });

    it('should throw error when check code invalid [invalid allowance]', async () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
      });

      await invoiceGateway.allowance(mockInvoice, [
        {
          name: '橡皮擦',
          unitPrice: 8,
          quantity: 1,
        },
      ]);

      expect(() =>
        invoiceGateway.invalidAllowance(mockInvoice.allowances[0], SHOULD_THROW_ALLOWANCE_REASON),
      ).rejects.toThrow();
    });

    it('should allowance invoice with buyer email for auto send notification with ezpay', async () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
      });

      await invoiceGateway.allowance(
        mockInvoice,
        [
          {
            name: '橡皮擦',
            unitPrice: 8,
            quantity: 1,
          },
        ],
        {
          buyerEmail: 'test@rytass.com',
        },
      );
    });

    it('should allowance invalid method can use new Date() for invalid time in default', async () => {
      INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

      const mockInvoice = new EZPayInvoice({
        items: [
          {
            name: '橡皮擦',
            unitPrice: 10,
            quantity: 2,
          },
        ],
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        platformId: FAKE_PLATFORM_ID,
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
      });

      await invoiceGateway.allowance(mockInvoice, [
        {
          name: '橡皮擦',
          unitPrice: 8,
          quantity: 1,
        },
      ]);

      await invoiceGateway.invalidAllowance(mockInvoice.allowances[0]);

      const originalInvalidTime = mockInvoice.allowances[0].invalidOn;

      mockInvoice.allowances[0].invalid();

      expect(originalInvalidTime).not.toBe(mockInvoice.allowances[0].invalidOn);
    });
  });
});
