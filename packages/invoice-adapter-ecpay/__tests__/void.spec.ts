/**
 * @jest-environment node
 */

import { ECPayInvoice, ECPayInvoiceGateway, InvoiceState, TaxType } from '../src';
import axios from 'axios';
import { createDecipheriv, createCipheriv } from 'crypto';

const DEFAULT_AES_IV = 'q9jcZX8Ib9LM8wYk';
const DEFAULT_AES_KEY = 'ejCk326UnaZWKisg';
const DEFAULT_MERCHANT_ID = '2000132';

describe('ECPayInvoiceGateway Void', () => {
  const post = jest.spyOn(axios, 'post');
  const invoiceGateway = new ECPayInvoiceGateway();

  const FAKE_INVOICE_NUMBER = 'JJ00050096';
  const FAKE_RANDOM_CODE = '9527';
  const FAKE_ORDER_ID = '202212260100401';
  const SHOULD_THROW_ERROR_REASON = 'THROWOOOWOWOW';

  beforeAll(() => {
    post.mockImplementation(async (url: string, data: unknown) => {
      const payload = JSON.parse(data as string) as {
        MerchantID: string;
        RqHeader: {
          Timestamp: number;
          Revision: '3.0.0';
        };
        Data: string;
      };

      const decipher = createDecipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

      const plainPayload = JSON.parse(
        decodeURIComponent([decipher.update(payload.Data, 'base64', 'utf8'), decipher.final('utf8')].join('')),
      ) as {
        InvoiceNo: string;
        InvoiceDate: string;
        Reason: string;
      };

      const cipher = createCipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

      cipher.setAutoPadding(true);

      if (plainPayload.InvoiceNo !== FAKE_INVOICE_NUMBER) {
        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            RpHeader: {
              Timestamp: Math.round(Date.now() / 1000),
              Revision: '3.0.0',
            },
            TransCode: 1,
            TransMsg: 'Success',
            Data: [
              cipher.update(
                encodeURIComponent(
                  JSON.stringify({
                    RtnCode: 1600003,
                    RtnMsg: '無發票號碼資料',
                    InvoiceNo: null,
                  }),
                ),
                'utf8',
                'base64',
              ),
              cipher.final('base64'),
            ].join(''),
          },
        };
      }

      return {
        data: {
          MerchantID: DEFAULT_MERCHANT_ID,
          RpHeader: {
            Timestamp: Math.round(Date.now() / 1000),
            Revision: '3.0.0',
          },
          TransCode: SHOULD_THROW_ERROR_REASON === plainPayload.Reason ? 999 : 1,
          TransMsg: 'Success',
          Data: [
            cipher.update(
              encodeURIComponent(
                JSON.stringify({
                  RtnCode: 1,
                  RtnMsg: '作廢發票成功',
                  InvoiceNo: FAKE_INVOICE_NUMBER,
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
  });

  it('should void an invoice', async () => {
    const mockInvoice = new ECPayInvoice({
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
      orderId: FAKE_ORDER_ID,
      taxType: TaxType.TAXED,
    });

    const voidedInvoice = await invoiceGateway.void(mockInvoice, {
      reason: '測試作廢',
    });

    expect(voidedInvoice.state === InvoiceState.VOID);
  });

  it('should throw error on invoice not found', () => {
    const mockInvoice = new ECPayInvoice({
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
    it('should throw error when ecpay reject request', () => {
      const mockInvoice = new ECPayInvoice({
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
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
      });

      expect(() =>
        invoiceGateway.void(mockInvoice, {
          reason: SHOULD_THROW_ERROR_REASON,
        }),
      ).rejects.toThrow();
    });
  });
});
