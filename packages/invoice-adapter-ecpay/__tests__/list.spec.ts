/**
 * @jest-environment node
 */

import axios from 'axios';
import { createDecipheriv, randomUUID } from 'crypto';
import { ECPayInvoiceGateway } from '../src/ecpay-invoice-gateway';
import { ECPayInvoiceListQueryRequestBody } from '../src/typings';
import { InvoiceState } from '@rytass/invoice';

const DEFAULT_AES_IV = 'q9jcZX8Ib9LM8wYk';
const DEFAULT_AES_KEY = 'ejCk326UnaZWKisg';
const DEFAULT_MERCHANT_ID = '2000132';

describe('ECPayInvoiceGateway List', () => {
  const post = jest.spyOn(axios, 'post');

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
      ) as ECPayInvoiceListQueryRequestBody;

      if (plainPayload.EndDate === '2020-12-31') {
        return {
          data: {
            TransCode: 1,
            Data: {
              ShowingPage: plainPayload.ShowingPage,
              RtnMsg: '成功',
              TotalCount: 0,
              InvoiceData: [],
              RtnCode: 1,
            },
            TransMsg: 'Success',
            PlatformID: 0,
            MerchantID: DEFAULT_MERCHANT_ID,
            RpHeader: {
              Timestamp: Math.floor(Date.now() / 1000),
              RqID: randomUUID(),
              Revision: null,
            },
          },
        };
      }

      return {
        data: {
          TransCode: plainPayload.BeginDate === '1990-01-01' ? -999 : 1,
          Data: {
            ShowingPage: plainPayload.ShowingPage,
            RtnMsg: '成功',
            TotalCount: 201,
            InvoiceData: Array.from(Array(plainPayload.ShowingPage === 1 ? 200 : 1)).map((n, index) => ({
              IIS_Identifier: '0000000000',
              IIS_Number: 'FJ20004474',
              IIS_Print_Flag: '0',
              IIS_Relate_Number: '3200119095958',
              IIS_Carrier_Type: '1',
              IIS_Award_Type: plainPayload.Query_Award === 1 ? '6' : null,
              IIS_Clearance_Mark: '',
              IIS_Issue_Status: '1',
              IIS_Upload_Status: '1',
              IIS_Category: 'B2C',
              IIS_Remain_Allowance_Amt: 2200,
              IIS_Turnkey_Status: 'C',
              IIS_Tax_Type: (() => {
                switch (index % 5) {
                  case 0:
                    return '1';

                  case 1:
                    return '2';

                  case 2:
                    return '3';

                  case 3:
                    return '4';

                  case 4:
                    return '9';
                }
              })(),
              IIS_Tax_Amount: 0,
              IIS_Tax_Rate: 0.05,
              IIS_Upload_Date: '2023-04-30 23:47:59',
              IIS_Carrier_Num: '190F12DD1A38F26E9AE4721C42A66D41',
              IIS_Sales_Amount: 2200,
              IIS_Love_Code: '0',
              IIS_Award_Flag: plainPayload.Query_Award === 1 ? '1' : '',
              IIS_Create_Date: '2023-04-30 23:47:59',
              IIS_Invalid_Status: plainPayload.Query_Invalid === 1 ? '1' : '0',
            })),
            RtnCode: 1,
          },
          TransMsg: 'Success',
          PlatformID: 0,
          MerchantID: DEFAULT_MERCHANT_ID,
          RpHeader: {
            Timestamp: Math.floor(Date.now() / 1000),
            RqID: randomUUID(),
            Revision: null,
          },
        },
      };
    });
  });

  it('should get multipage records', async () => {
    const gateway = new ECPayInvoiceGateway();

    const invoices = await gateway.list({
      startDate: '2023-04-01',
      endDate: '2023-04-30',
    });

    expect(invoices.length).toBe(201);
  });

  it('should get awarded records', async () => {
    const gateway = new ECPayInvoiceGateway();

    const invoices = await gateway.list({
      startDate: '2023-04-01',
      endDate: '2023-04-30',
      onlyAward: true,
    });

    invoices.forEach(invoice => {
      expect(invoice.awardType).not.toBeFalsy();
    });
  });

  it('should get voided records', async () => {
    const gateway = new ECPayInvoiceGateway();

    const invoices = await gateway.list({
      startDate: '2023-04-01',
      endDate: '2023-04-30',
      onlyInvalid: true,
    });

    invoices.forEach(invoice => {
      expect(invoice.state).toBe(InvoiceState.VOID);
    });
  });

  it('should handle no data', async () => {
    const gateway = new ECPayInvoiceGateway();

    const invoices = await gateway.list({
      startDate: '2020-04-01',
      endDate: '2020-12-31',
      onlyInvalid: true,
    });

    expect(invoices.length).toBe(0);
  });

  it('should handle server error', async () => {
    const gateway = new ECPayInvoiceGateway();

    expect(
      gateway.list({
        startDate: '1990-01-01',
        endDate: '2000-12-31',
      }),
    ).rejects.toThrow();
  });
});
