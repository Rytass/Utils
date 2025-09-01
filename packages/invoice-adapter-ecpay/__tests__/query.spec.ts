/**
 * @jest-environment node
 */

import { createDecipheriv, createCipheriv } from 'crypto';
import { DateTime } from 'luxon';
import axios from 'axios';
import {
  ECPayInvoiceGateway,
  ECPayInvoiceQueryRequestBody,
  InvoiceState,
  TaxType,
} from '../src';

const DEFAULT_AES_IV = 'q9jcZX8Ib9LM8wYk';
const DEFAULT_AES_KEY = 'ejCk326UnaZWKisg';
const DEFAULT_MERCHANT_ID = '2000132';

describe('ECPay Invoice Query', () => {
  const gateway = new ECPayInvoiceGateway();

  it('should query invoice with orderId', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      expect(url).toMatch(/\/B2CInvoice\/GetIssue$/);

      const payload = JSON.parse(data) as {
        MerchantID: string;
        RqHeader: {
          Timestamp: number;
        };
        Data: string;
      };

      const decipher = createDecipheriv(
        'aes-128-cbc',
        DEFAULT_AES_KEY,
        DEFAULT_AES_IV,
      );

      const plainInfo = JSON.parse(
        decodeURIComponent(
          [
            decipher.update(payload.Data, 'base64', 'utf8'),
            decipher.final('utf8'),
          ].join(''),
        ),
      ) as ECPayInvoiceQueryRequestBody;

      expect(plainInfo.MerchantID).toBe(DEFAULT_MERCHANT_ID);

      if ('RelateNumber' in plainInfo) {
        expect(plainInfo.RelateNumber).toBe('f581df41f1a65f05');
      }

      const cipher = createCipheriv(
        'aes-128-cbc',
        DEFAULT_AES_KEY,
        DEFAULT_AES_IV,
      );

      return {
        data: {
          TransCode: 1,
          Data: `${cipher.update(
            JSON.stringify({
              IIS_Mer_ID: 2000132,
              IIS_Number: 'ZZ18003921',
              IIS_Relate_Number: 'f581df41f1a65f05',
              IIS_Customer_ID: '',
              IIS_Identifier: '0000000000',
              IIS_Customer_Name: '',
              IIS_Customer_Addr: '',
              IIS_Customer_Phone: '',
              IIS_Customer_Email: 'test@fake.com',
              IIS_Clearance_Mark: '',
              IIS_Type: '07',
              IIS_Category: 'B2C',
              IIS_Tax_Type: '1',
              IIS_Tax_Rate: 0.05,
              IIS_Tax_Amount: 0,
              IIS_Sales_Amount: 10,
              IIS_Check_Number: 'P',
              IIS_Carrier_Type: '1',
              IIS_Carrier_Num: 'EFFF3C85852C67A89B4A665453B38CD7',
              IIS_Love_Code: '0',
              IIS_IP: '203.69.123.208',
              IIS_Create_Date: '2023-02-03+17:57:02',
              IIS_Issue_Status: '1',
              IIS_Invalid_Status: '0',
              IIS_Upload_Status: '0',
              IIS_Upload_Date: '',
              IIS_Turnkey_Status: '',
              IIS_Remain_Allowance_Amt: 10,
              IIS_Print_Flag: '0',
              IIS_Award_Flag: '',
              IIS_Award_Type: 0,
              IIS_Random_Number: '3321',
              InvoiceRemark: '',
              QRCode_Left:
                'ZZ1800392111202033321000000000000000a0000000053538851ArHRuIogr+53dRHxChr5Tw==:**********:1:1:1:橡皮擦:1:10:',
              QRCode_Right: '**',
              PosBarCode: '11202ZZ180039213321',
              SpecialTaxType: 0,
              Items: [
                {
                  ItemSeq: 1,
                  ItemName: '橡皮擦',
                  ItemCount: 10,
                  ItemWord: '個',
                  ItemPrice: 10,
                  ItemTaxType: '1',
                  ItemAmount: 100,
                  ItemRemark: null,
                },
              ],
              RtnMsg: '查詢成功',
              RtnCode: 1,
            }),
            'utf8',
            'base64',
          )}${cipher.final('base64')}`,
          TransMsg: 'Success',
          PlatformID: 0,
          MerchantID: 2000132,
          RpHeader: {
            Timestamp: 1675418422,
            RqID: '133d9e65-e8fe-4ffe-91fa-cc2152c42dde',
            Revision: null,
          },
        },
      };
    });

    const invoice = await gateway.query({ orderId: 'f581df41f1a65f05' });

    expect(invoice.invoiceNumber).toBe('ZZ18003921');
    expect(invoice.randomCode).toBe('3321');
    expect(invoice.issuedAmount).toBe(100);
    expect(invoice.taxType).toBe('TAXED');
    expect(invoice.items.length).toEqual(1);
    expect(DateTime.fromJSDate(invoice.issuedOn).toFormat('yyyyMMdd')).toBe(
      '20230203',
    );

    expect(invoice.state).toBe(InvoiceState.ISSUED);
    expect(invoice.orderId).toBe('f581df41f1a65f05');
  });

  it('should query invoice with invoice number and issued on', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      expect(url).toMatch(/\/B2CInvoice\/GetIssue$/);

      const payload = JSON.parse(data) as {
        MerchantID: string;
        RqHeader: {
          Timestamp: number;
        };
        Data: string;
      };

      const decipher = createDecipheriv(
        'aes-128-cbc',
        DEFAULT_AES_KEY,
        DEFAULT_AES_IV,
      );

      const plainInfo = JSON.parse(
        decodeURIComponent(
          [
            decipher.update(payload.Data, 'base64', 'utf8'),
            decipher.final('utf8'),
          ].join(''),
        ),
      ) as ECPayInvoiceQueryRequestBody;

      expect(plainInfo.MerchantID).toBe(DEFAULT_MERCHANT_ID);

      if ('InvoiceNo' in plainInfo) {
        expect(plainInfo.InvoiceNo).toBe('ZZ18003921');
        expect(plainInfo.InvoiceDate).toBe('2023-02-03');
      }

      const cipher = createCipheriv(
        'aes-128-cbc',
        DEFAULT_AES_KEY,
        DEFAULT_AES_IV,
      );

      return {
        data: {
          TransCode: 1,
          Data: `${cipher.update(
            JSON.stringify({
              IIS_Mer_ID: 2000132,
              IIS_Number: 'ZZ18003921',
              IIS_Relate_Number: 'f581df41f1a65f05',
              IIS_Customer_ID: '',
              IIS_Identifier: '0000000000',
              IIS_Customer_Name: '',
              IIS_Customer_Addr: '',
              IIS_Customer_Phone: '',
              IIS_Customer_Email: 'test@fake.com',
              IIS_Clearance_Mark: '',
              IIS_Type: '07',
              IIS_Category: 'B2C',
              IIS_Tax_Type: '1',
              IIS_Tax_Rate: 0.05,
              IIS_Tax_Amount: 0,
              IIS_Sales_Amount: 10,
              IIS_Check_Number: 'P',
              IIS_Carrier_Type: '1',
              IIS_Carrier_Num: 'EFFF3C85852C67A89B4A665453B38CD7',
              IIS_Love_Code: '0',
              IIS_IP: '203.69.123.208',
              IIS_Create_Date: '2023-02-03+17:57:02',
              IIS_Issue_Status: '1',
              IIS_Invalid_Status: '0',
              IIS_Upload_Status: '0',
              IIS_Upload_Date: '',
              IIS_Turnkey_Status: '',
              IIS_Remain_Allowance_Amt: 10,
              IIS_Print_Flag: '0',
              IIS_Award_Flag: '',
              IIS_Award_Type: 0,
              IIS_Random_Number: '3321',
              InvoiceRemark: '',
              QRCode_Left:
                'ZZ1800392111202033321000000000000000a0000000053538851ArHRuIogr+53dRHxChr5Tw==:**********:1:1:1:橡皮擦:1:10:',
              QRCode_Right: '**',
              PosBarCode: '11202ZZ180039213321',
              SpecialTaxType: 0,
              Items: [
                {
                  ItemSeq: 1,
                  ItemName: '橡皮擦',
                  ItemCount: 1,
                  ItemWord: '個',
                  ItemPrice: 10,
                  ItemTaxType: '1',
                  ItemAmount: 10,
                  ItemRemark: null,
                },
              ],
              RtnMsg: '查詢成功',
              RtnCode: 1,
            }),
            'utf8',
            'base64',
          )}${cipher.final('base64')}`,
          TransMsg: 'Success',
          PlatformID: 0,
          MerchantID: 2000132,
          RpHeader: {
            Timestamp: 1675418422,
            RqID: '133d9e65-e8fe-4ffe-91fa-cc2152c42dde',
            Revision: null,
          },
        },
      };
    });

    const invoice = await gateway.query({
      invoiceNumber: 'ZZ18003921',
      issuedOn: DateTime.fromFormat('20230203', 'yyyyMMdd').toJSDate(),
    });

    expect(invoice.invoiceNumber).toBe('ZZ18003921');
    expect(invoice.randomCode).toBe('3321');
    expect(DateTime.fromJSDate(invoice.issuedOn).toFormat('yyyyMMdd')).toBe(
      '20230203',
    );
  });

  it('should query zero tax invoice', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      const cipher = createCipheriv(
        'aes-128-cbc',
        DEFAULT_AES_KEY,
        DEFAULT_AES_IV,
      );

      return {
        data: {
          TransCode: 1,
          Data: `${cipher.update(
            JSON.stringify({
              IIS_Mer_ID: 2000132,
              IIS_Number: 'ZZ18003921',
              IIS_Relate_Number: 'f581df41f1a65f05',
              IIS_Customer_ID: '',
              IIS_Identifier: '0000000000',
              IIS_Customer_Name: '',
              IIS_Customer_Addr: '',
              IIS_Customer_Phone: '',
              IIS_Customer_Email: 'test@fake.com',
              IIS_Clearance_Mark: '',
              IIS_Type: '07',
              IIS_Category: 'B2C',
              IIS_Tax_Type: '2',
              IIS_Tax_Rate: 0.05,
              IIS_Tax_Amount: 0,
              IIS_Sales_Amount: 10,
              IIS_Check_Number: 'P',
              IIS_Carrier_Type: '1',
              IIS_Carrier_Num: 'EFFF3C85852C67A89B4A665453B38CD7',
              IIS_Love_Code: '0',
              IIS_IP: '203.69.123.208',
              IIS_Create_Date: '2023-02-03+17:57:02',
              IIS_Issue_Status: '1',
              IIS_Invalid_Status: '0',
              IIS_Upload_Status: '0',
              IIS_Upload_Date: '',
              IIS_Turnkey_Status: '',
              IIS_Remain_Allowance_Amt: 10,
              IIS_Print_Flag: '0',
              IIS_Award_Flag: '',
              IIS_Award_Type: 0,
              IIS_Random_Number: '3321',
              InvoiceRemark: '',
              QRCode_Left:
                'ZZ1800392111202033321000000000000000a0000000053538851ArHRuIogr+53dRHxChr5Tw==:**********:1:1:1:橡皮擦:1:10:',
              QRCode_Right: '**',
              PosBarCode: '11202ZZ180039213321',
              SpecialTaxType: 0,
              Items: [
                {
                  ItemSeq: 1,
                  ItemName: '橡皮擦',
                  ItemCount: 1,
                  ItemWord: '個',
                  ItemPrice: 10,
                  ItemTaxType: '2',
                  ItemAmount: 10,
                  ItemRemark: null,
                },
              ],
              RtnMsg: '查詢成功',
              RtnCode: 1,
            }),
            'utf8',
            'base64',
          )}${cipher.final('base64')}`,
          TransMsg: 'Success',
          PlatformID: 0,
          MerchantID: 2000132,
          RpHeader: {
            Timestamp: 1675418422,
            RqID: '133d9e65-e8fe-4ffe-91fa-cc2152c42dde',
            Revision: null,
          },
        },
      };
    });

    const invoice = await gateway.query({
      invoiceNumber: 'ZZ18003921',
      issuedOn: DateTime.fromFormat('20230203', 'yyyyMMdd').toJSDate(),
    });

    expect(invoice.items[0].taxType).toBe(TaxType.ZERO_TAX);
    expect(invoice.taxType).toBe(TaxType.ZERO_TAX);
  });

  it('should query tax free invoice', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      const cipher = createCipheriv(
        'aes-128-cbc',
        DEFAULT_AES_KEY,
        DEFAULT_AES_IV,
      );

      return {
        data: {
          TransCode: 1,
          Data: `${cipher.update(
            JSON.stringify({
              IIS_Mer_ID: 2000132,
              IIS_Number: 'ZZ18003921',
              IIS_Relate_Number: 'f581df41f1a65f05',
              IIS_Customer_ID: '',
              IIS_Identifier: '0000000000',
              IIS_Customer_Name: '',
              IIS_Customer_Addr: '',
              IIS_Customer_Phone: '',
              IIS_Customer_Email: 'test@fake.com',
              IIS_Clearance_Mark: '',
              IIS_Type: '07',
              IIS_Category: 'B2C',
              IIS_Tax_Type: '3',
              IIS_Tax_Rate: 0.05,
              IIS_Tax_Amount: 0,
              IIS_Sales_Amount: 10,
              IIS_Check_Number: 'P',
              IIS_Carrier_Type: '1',
              IIS_Carrier_Num: 'EFFF3C85852C67A89B4A665453B38CD7',
              IIS_Love_Code: '0',
              IIS_IP: '203.69.123.208',
              IIS_Create_Date: '2023-02-03+17:57:02',
              IIS_Issue_Status: '1',
              IIS_Invalid_Status: '0',
              IIS_Upload_Status: '0',
              IIS_Upload_Date: '',
              IIS_Turnkey_Status: '',
              IIS_Remain_Allowance_Amt: 10,
              IIS_Print_Flag: '0',
              IIS_Award_Flag: '',
              IIS_Award_Type: 0,
              IIS_Random_Number: '3321',
              InvoiceRemark: '',
              QRCode_Left:
                'ZZ1800392111202033321000000000000000a0000000053538851ArHRuIogr+53dRHxChr5Tw==:**********:1:1:1:橡皮擦:1:10:',
              QRCode_Right: '**',
              PosBarCode: '11202ZZ180039213321',
              SpecialTaxType: 0,
              Items: [
                {
                  ItemSeq: 1,
                  ItemName: '橡皮擦',
                  ItemCount: 1,
                  ItemWord: '個',
                  ItemPrice: 10,
                  ItemTaxType: '3',
                  ItemAmount: 10,
                  ItemRemark: null,
                },
              ],
              RtnMsg: '查詢成功',
              RtnCode: 1,
            }),
            'utf8',
            'base64',
          )}${cipher.final('base64')}`,
          TransMsg: 'Success',
          PlatformID: 0,
          MerchantID: 2000132,
          RpHeader: {
            Timestamp: 1675418422,
            RqID: '133d9e65-e8fe-4ffe-91fa-cc2152c42dde',
            Revision: null,
          },
        },
      };
    });

    const invoice = await gateway.query({
      invoiceNumber: 'ZZ18003921',
      issuedOn: DateTime.fromFormat('20230203', 'yyyyMMdd').toJSDate(),
    });

    expect(invoice.items[0].taxType).toBe(TaxType.TAX_FREE);
    expect(invoice.taxType).toBe(TaxType.TAX_FREE);
  });

  it('should query special tax invoice', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      const cipher = createCipheriv(
        'aes-128-cbc',
        DEFAULT_AES_KEY,
        DEFAULT_AES_IV,
      );

      return {
        data: {
          TransCode: 1,
          Data: `${cipher.update(
            JSON.stringify({
              IIS_Mer_ID: 2000132,
              IIS_Number: 'ZZ18003921',
              IIS_Relate_Number: 'f581df41f1a65f05',
              IIS_Customer_ID: '',
              IIS_Identifier: '0000000000',
              IIS_Customer_Name: '',
              IIS_Customer_Addr: '',
              IIS_Customer_Phone: '',
              IIS_Customer_Email: 'test@fake.com',
              IIS_Clearance_Mark: '',
              IIS_Type: '07',
              IIS_Category: 'B2C',
              IIS_Tax_Type: '4',
              IIS_Tax_Rate: 0.05,
              IIS_Tax_Amount: 0,
              IIS_Sales_Amount: 10,
              IIS_Check_Number: 'P',
              IIS_Carrier_Type: '1',
              IIS_Carrier_Num: 'EFFF3C85852C67A89B4A665453B38CD7',
              IIS_Love_Code: '0',
              IIS_IP: '203.69.123.208',
              IIS_Create_Date: '2023-02-03+17:57:02',
              IIS_Issue_Status: '1',
              IIS_Invalid_Status: '0',
              IIS_Upload_Status: '0',
              IIS_Upload_Date: '',
              IIS_Turnkey_Status: '',
              IIS_Remain_Allowance_Amt: 10,
              IIS_Print_Flag: '0',
              IIS_Award_Flag: '',
              IIS_Award_Type: 0,
              IIS_Random_Number: '3321',
              InvoiceRemark: '',
              QRCode_Left:
                'ZZ1800392111202033321000000000000000a0000000053538851ArHRuIogr+53dRHxChr5Tw==:**********:1:1:1:橡皮擦:1:10:',
              QRCode_Right: '**',
              PosBarCode: '11202ZZ180039213321',
              SpecialTaxType: 0,
              Items: [
                {
                  ItemSeq: 1,
                  ItemName: '橡皮擦',
                  ItemCount: 1,
                  ItemWord: '個',
                  ItemPrice: 10,
                  ItemTaxType: null,
                  ItemAmount: 10,
                  ItemRemark: null,
                },
              ],
              RtnMsg: '查詢成功',
              RtnCode: 1,
            }),
            'utf8',
            'base64',
          )}${cipher.final('base64')}`,
          TransMsg: 'Success',
          PlatformID: 0,
          MerchantID: 2000132,
          RpHeader: {
            Timestamp: 1675418422,
            RqID: '133d9e65-e8fe-4ffe-91fa-cc2152c42dde',
            Revision: null,
          },
        },
      };
    });

    const invoice = await gateway.query({
      invoiceNumber: 'ZZ18003921',
      issuedOn: DateTime.fromFormat('20230203', 'yyyyMMdd').toJSDate(),
    });

    expect(invoice.items[0].taxType).toBeUndefined();
    expect(invoice.taxType).toBe(TaxType.SPECIAL);
  });

  it('should query mixed tax invoice', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      const cipher = createCipheriv(
        'aes-128-cbc',
        DEFAULT_AES_KEY,
        DEFAULT_AES_IV,
      );

      return {
        data: {
          TransCode: 1,
          Data: `${cipher.update(
            JSON.stringify({
              IIS_Mer_ID: 2000132,
              IIS_Number: 'ZZ18003921',
              IIS_Relate_Number: 'f581df41f1a65f05',
              IIS_Customer_ID: '',
              IIS_Identifier: '0000000000',
              IIS_Customer_Name: '',
              IIS_Customer_Addr: '',
              IIS_Customer_Phone: '',
              IIS_Customer_Email: 'test@fake.com',
              IIS_Clearance_Mark: '',
              IIS_Type: '07',
              IIS_Category: 'B2C',
              IIS_Tax_Type: '9',
              IIS_Tax_Rate: 0.05,
              IIS_Tax_Amount: 0,
              IIS_Sales_Amount: 10,
              IIS_Check_Number: 'P',
              IIS_Carrier_Type: '1',
              IIS_Carrier_Num: 'EFFF3C85852C67A89B4A665453B38CD7',
              IIS_Love_Code: '0',
              IIS_IP: '203.69.123.208',
              IIS_Create_Date: '2023-02-03+17:57:02',
              IIS_Issue_Status: '1',
              IIS_Invalid_Status: '0',
              IIS_Upload_Status: '0',
              IIS_Upload_Date: '',
              IIS_Turnkey_Status: '',
              IIS_Remain_Allowance_Amt: 10,
              IIS_Print_Flag: '0',
              IIS_Award_Flag: '',
              IIS_Award_Type: 0,
              IIS_Random_Number: '3321',
              InvoiceRemark: '',
              QRCode_Left:
                'ZZ1800392111202033321000000000000000a0000000053538851ArHRuIogr+53dRHxChr5Tw==:**********:1:1:1:橡皮擦:1:10:',
              QRCode_Right: '**',
              PosBarCode: '11202ZZ180039213321',
              SpecialTaxType: 0,
              Items: [
                {
                  ItemSeq: 1,
                  ItemName: '橡皮擦',
                  ItemCount: 1,
                  ItemWord: '個',
                  ItemPrice: 10,
                  ItemTaxType: '1',
                  ItemAmount: 5,
                  ItemRemark: null,
                },
                {
                  ItemSeq: 1,
                  ItemName: '免稅橡皮擦',
                  ItemCount: 1,
                  ItemWord: '個',
                  ItemPrice: 10,
                  ItemTaxType: '3',
                  ItemAmount: 5,
                  ItemRemark: null,
                },
              ],
              RtnMsg: '查詢成功',
              RtnCode: 1,
            }),
            'utf8',
            'base64',
          )}${cipher.final('base64')}`,
          TransMsg: 'Success',
          PlatformID: 0,
          MerchantID: 2000132,
          RpHeader: {
            Timestamp: 1675418422,
            RqID: '133d9e65-e8fe-4ffe-91fa-cc2152c42dde',
            Revision: null,
          },
        },
      };
    });

    const invoice = await gateway.query({
      invoiceNumber: 'ZZ18003921',
      issuedOn: DateTime.fromFormat('20230203', 'yyyyMMdd').toJSDate(),
    });

    expect(invoice.items[0].taxType).toBe(TaxType.TAXED);
    expect(invoice.items[1].taxType).toBe(TaxType.TAX_FREE);
    expect(invoice.taxType).toBe(TaxType.MIXED);
  });

  it('should throw error when ecpay return gateway error', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      return {
        data: {
          TransCode: '-999',
          Data: '',
          TransMsg: 'FAILED',
          PlatformID: 0,
          MerchantID: 2000132,
          RpHeader: {
            Timestamp: 1675418422,
            RqID: '133d9e65-e8fe-4ffe-91fa-cc2152c42dde',
            Revision: null,
          },
        },
      };
    });

    expect(() =>
      gateway.query({
        invoiceNumber: 'ZZ18003921',
        issuedOn: DateTime.fromFormat('20230203', 'yyyyMMdd').toJSDate(),
      }),
    ).rejects.toThrowError('ECPay gateway error');
  });

  it('should throw error when ecpay return query error', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      const cipher = createCipheriv(
        'aes-128-cbc',
        DEFAULT_AES_KEY,
        DEFAULT_AES_IV,
      );

      return {
        data: {
          TransCode: 1,
          Data: `${cipher.update(
            JSON.stringify({
              RtnMsg: '查詢失敗',
              RtnCode: -999,
            }),
            'utf8',
            'base64',
          )}${cipher.final('base64')}`,
          TransMsg: 'SUCCESS',
          PlatformID: 0,
          MerchantID: 2000132,
          RpHeader: {
            Timestamp: 1675418422,
            RqID: '133d9e65-e8fe-4ffe-91fa-cc2152c42dde',
            Revision: null,
          },
        },
      };
    });

    expect(() =>
      gateway.query({
        invoiceNumber: 'ZZ18003921',
        issuedOn: DateTime.fromFormat('20230203', 'yyyyMMdd').toJSDate(),
      }),
    ).rejects.toThrow();
  });
});
