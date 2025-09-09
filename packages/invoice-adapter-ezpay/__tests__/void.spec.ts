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
  EZPayInvoiceGateway,
  EZPayInvoiceVoidPayload,
  InvoiceState,
  TaxType,
} from '../src';

const AES_IV = 'gmY2MPN8PHFvA7KR';
const AES_KEY = 'cNg3wIe8PkCVcqb37RY0LFbf00FgrNXg';
const MERCHANT_ID = '31090553';

function getResponseCheckCode<T>(response: T): string {
  const encodedData = Object.entries(response as Record<string, unknown>)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return createHash('sha256').update(`HashIV=${AES_IV}&${encodedData}&HashKey=${AES_KEY}`).digest('hex').toUpperCase();
}

describe('EZPayInvoiceGateway Void', () => {
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
  const SHOULD_THROW_REASON = 'THROWWWWW';

  beforeAll(() => {
    post.mockImplementation(async (_url: string, data: unknown) => {
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

      const params = plainText.split(/&/).reduce((vars, item) => {
        const [key, value] = item.split(/=/);

        return {
          ...vars,
          [key]: decodeURIComponent(value),
        };
      }, {}) as EZPayInvoiceVoidPayload;

      if (params.InvoiceNumber !== FAKE_INVOICE_NUMBER) {
        return {
          data: {
            Message: '查無發票資料',
            Status: 'INV20006',
            Result: [],
          },
        };
      }

      return {
        data: {
          Message: '電子發票作廢開立成功',
          Status: 'SUCCESS',
          Result: JSON.stringify({
            CheckCode: getResponseCheckCode({
              InvoiceTransNo: FAKE_PLATFORM_ID,
              MerchantID: SHOULD_THROW_REASON === params.InvalidReason ? 'INVALID_MERCHANT' : MERCHANT_ID,
              MerchantOrderNo: FAKE_ORDER_ID,
              RandomNum: FAKE_RANDOM_CODE,
              TotalAmt: 20,
            }),
            MerchantID: MERCHANT_ID,
            InvoiceNumber: FAKE_INVOICE_NUMBER,
            CreateTime: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
          }),
        },
      };
    });
  });

  it('should void an invoice', async () => {
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

    const voidedInvoice = await invoiceGateway.void(mockInvoice, {
      reason: '測試作廢',
    });

    expect(voidedInvoice.state === InvoiceState.VOID);
  });

  it('should throw error on invoice not found', () => {
    const mockInvoice = new EZPayInvoice({
      items: [
        {
          name: '橡皮擦',
          unitPrice: 10,
          quantity: 2,
        },
      ],
      issuedOn: new Date(),
      invoiceNumber: 'GG00148493',
      randomCode: FAKE_RANDOM_CODE,
      platformId: FAKE_PLATFORM_ID,
      orderId: FAKE_ORDER_ID,
      taxType: TaxType.TAXED,
    });

    expect(() =>
      invoiceGateway.void(mockInvoice, {
        reason: '測試作廢',
      }),
    ).rejects.toThrow();
  });

  describe('Misc', () => {
    it('should throw error when check code invalid', async () => {
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

      expect(() => invoiceGateway.void(mockInvoice, { reason: SHOULD_THROW_REASON })).rejects.toThrow();
    });

    it('should invoice setVoid method can use new Date() for void time in default', async () => {
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

      mockInvoice.setVoid();

      expect(mockInvoice.voidOn).toBeInstanceOf(Date);
      expect(mockInvoice.state).toBe(InvoiceState.VOID);
    });
  });
});
