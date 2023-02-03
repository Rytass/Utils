/**
 * @jest-environment node
 */

import axios from 'axios';
import { parse } from 'parse-multipart-data';
import FormData from 'form-data';
import { createDecipheriv, createHash } from 'crypto';
import { DateTime } from 'luxon';
import { EZPayInvoiceGateway, EZPayBaseUrls, InvoiceState, TaxType } from '../src';

const AES_IV = 'gmY2MPN8PHFvA7KR';
const AES_KEY = 'cNg3wIe8PkCVcqb37RY0LFbf00FgrNXg';
const MERCHANT_ID = '31090553';

describe('EZPay Invoice Query', () => {
  const gateway = new EZPayInvoiceGateway({
    hashIv: AES_IV,
    hashKey: AES_KEY,
    merchantId: MERCHANT_ID,
    baseUrl: EZPayBaseUrls.DEVELOPMENT,
  });

  it('should query invoice with invoice number', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      expect(url).toMatch(/\/Api\/invoice_search$/);

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

      const params = new URLSearchParams([
        decipher.update(payload.PostData_, 'hex', 'utf8'),
        decipher.final('utf8'),
      ].join(''));

      expect(params.get('RespondType')).toBe('JSON');
      expect(params.get('Version')).toBe('1.3');
      expect(params.get('InvoiceNumber')).toBe('FF00000001');
      expect(params.get('RandomNum')).toBe('1440');

      return {
        data: {
          MerchantID: MERCHANT_ID,
          Status: 'SUCCESS',
          Result: JSON.stringify({
            Amt: '19',
            BarCode: '11202FF000000011440',
            BuyerAddress: '',
            BuyerEmail: 'user@rytass.com',
            BuyerName: 'Tester',
            BuyerPhone: '',
            BuyerUBN: '',
            CarrierNum: '',
            CarrierType: '',
            Category: 'B2C',
            CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&InvoiceTransNo=23020318530290616&MerchantID=${MERCHANT_ID}&MerchantOrderNo=90h31g023476g234g&RandomNum=1440&TotalAmt=20&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
            CreateStatusTime: '',
            CreateTime: '2023-02-03 18:53:02',
            InvoiceNumber: 'FF00000001',
            InvoiceStatus: '1',
            InvoiceTransNo: '23020318530290616',
            InvoiceType: '07',
            ItemDetail: JSON.stringify([{
              ItemAmount: '20',
              ItemCount: '2',
              ItemName: '橡皮擦',
              ItemNum: '1',
              ItemPrice: '10',
              ItemRemark: '',
              ItemTaxType: '',
              ItemWord: '式',
              RelateNumber: '',
            }]),
            KioskPrintFlag: '',
            LoveCode: '',
            MerchantID: '31090553',
            MerchantOrderNo: '90h31g023476g234g',
            PrintFlag: 'Y',
            QRcodeL: 'FF000000011120203144000000013000000140000000001012145GQVWH99zBlXEGWDbB0LloA==:**********:1:1:1:橡皮擦:2:10',
            QRcodeR: '**',
            RandomNum: '1440',
            TaxAmt: '1',
            TaxRate: '0.05000',
            TaxType: '1',
            TotalAmt: '20',
            UploadStatus: '1',
          }),
        },
      };
    });

    const invoice = await gateway.query({
      invoiceNumber: 'FF00000001',
      randomCode: '1440',
    });

    expect(invoice.invoiceNumber).toBe('FF00000001');
    expect(invoice.randomCode).toBe('1440');
    expect(invoice.orderId).toBe('90h31g023476g234g');
    expect(invoice.issuedAmount).toBe(200);
    expect(invoice.state).toBe(InvoiceState.ISSUED);
    expect(DateTime.fromJSDate(invoice.issuedOn).toFormat('yyyyMMdd')).toBe('20230203');
  });

  it('should query invoice with orderId', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      expect(url).toMatch(/\/Api\/invoice_search$/);

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

      const params = new URLSearchParams([
        decipher.update(payload.PostData_, 'hex', 'utf8'),
        decipher.final('utf8'),
      ].join(''));

      expect(params.get('RespondType')).toBe('JSON');
      expect(params.get('Version')).toBe('1.3');
      expect(params.get('MerchantOrderNo')).toBe('90h31g023476g234g');
      expect(params.get('TotalAmt')).toBe('200');

      return {
        data: {
          MerchantID: MERCHANT_ID,
          Status: 'SUCCESS',
          Result: JSON.stringify({
            Amt: '19',
            BarCode: '11202FF000000011440',
            BuyerAddress: '',
            BuyerEmail: 'user@rytass.com',
            BuyerName: 'Tester',
            BuyerPhone: '',
            BuyerUBN: '',
            CarrierNum: '',
            CarrierType: '',
            Category: 'B2C',
            CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&InvoiceTransNo=23020318530290616&MerchantID=${MERCHANT_ID}&MerchantOrderNo=90h31g023476g234g&RandomNum=1440&TotalAmt=20&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
            CreateStatusTime: '',
            CreateTime: '2023-02-03 18:53:02',
            InvoiceNumber: 'FF00000001',
            InvoiceStatus: '1',
            InvoiceTransNo: '23020318530290616',
            InvoiceType: '07',
            ItemDetail: JSON.stringify([{
              ItemAmount: '20',
              ItemCount: '2',
              ItemName: '橡皮擦',
              ItemNum: '1',
              ItemPrice: '10',
              ItemRemark: '',
              ItemTaxType: '',
              ItemWord: '式',
              RelateNumber: '',
            }]),
            KioskPrintFlag: '',
            LoveCode: '',
            MerchantID: '31090553',
            MerchantOrderNo: '90h31g023476g234g',
            PrintFlag: 'Y',
            QRcodeL: 'FF000000011120203144000000013000000140000000001012145GQVWH99zBlXEGWDbB0LloA==:**********:1:1:1:橡皮擦:2:10',
            QRcodeR: '**',
            RandomNum: '1440',
            TaxAmt: '1',
            TaxRate: '0.05000',
            TaxType: '1',
            TotalAmt: '20',
            UploadStatus: '1',
          }),
        },
      };
    });

    const invoice = await gateway.query({
      orderId: '90h31g023476g234g',
      amount: 200,
    });

    expect(invoice.invoiceNumber).toBe('FF00000001');
    expect(invoice.randomCode).toBe('1440');
    expect(invoice.orderId).toBe('90h31g023476g234g');
    expect(invoice.issuedAmount).toBe(200);
  });

  it('should query zero tax invoice with orderId', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      expect(url).toMatch(/\/Api\/invoice_search$/);

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

      const params = new URLSearchParams([
        decipher.update(payload.PostData_, 'hex', 'utf8'),
        decipher.final('utf8'),
      ].join(''));

      expect(params.get('RespondType')).toBe('JSON');
      expect(params.get('Version')).toBe('1.3');
      expect(params.get('MerchantOrderNo')).toBe('90h31g023476g234g');
      expect(params.get('TotalAmt')).toBe('200');

      return {
        data: {
          MerchantID: MERCHANT_ID,
          Status: 'SUCCESS',
          Result: JSON.stringify({
            Amt: '19',
            BarCode: '11202FF000000011440',
            BuyerAddress: '',
            BuyerEmail: 'user@rytass.com',
            BuyerName: 'Tester',
            BuyerPhone: '',
            BuyerUBN: '',
            CarrierNum: '',
            CarrierType: '',
            Category: 'B2C',
            CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&InvoiceTransNo=23020318530290616&MerchantID=${MERCHANT_ID}&MerchantOrderNo=90h31g023476g234g&RandomNum=1440&TotalAmt=20&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
            CreateStatusTime: '',
            CreateTime: '2023-02-03 18:53:02',
            InvoiceNumber: 'FF00000001',
            InvoiceStatus: '1',
            InvoiceTransNo: '23020318530290616',
            InvoiceType: '07',
            ItemDetail: JSON.stringify([{
              ItemAmount: '20',
              ItemCount: '2',
              ItemName: '橡皮擦',
              ItemNum: '1',
              ItemPrice: '10',
              ItemRemark: '',
              ItemTaxType: '',
              ItemWord: '式',
              RelateNumber: '',
            }]),
            KioskPrintFlag: '',
            LoveCode: '',
            MerchantID: '31090553',
            MerchantOrderNo: '90h31g023476g234g',
            PrintFlag: 'Y',
            QRcodeL: 'FF000000011120203144000000013000000140000000001012145GQVWH99zBlXEGWDbB0LloA==:**********:1:1:1:橡皮擦:2:10',
            QRcodeR: '**',
            RandomNum: '1440',
            TaxAmt: '1',
            TaxRate: '0.05000',
            TaxType: '2',
            TotalAmt: '20',
            UploadStatus: '1',
          }),
        },
      };
    });

    const invoice = await gateway.query({
      orderId: '90h31g023476g234g',
      amount: 200,
    });

    expect(invoice.taxType).toBe(TaxType.ZERO_TAX);
  });

  it('should query tax free invoice with orderId', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      expect(url).toMatch(/\/Api\/invoice_search$/);

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

      const params = new URLSearchParams([
        decipher.update(payload.PostData_, 'hex', 'utf8'),
        decipher.final('utf8'),
      ].join(''));

      expect(params.get('RespondType')).toBe('JSON');
      expect(params.get('Version')).toBe('1.3');
      expect(params.get('MerchantOrderNo')).toBe('90h31g023476g234g');
      expect(params.get('TotalAmt')).toBe('200');

      return {
        data: {
          MerchantID: MERCHANT_ID,
          Status: 'SUCCESS',
          Result: JSON.stringify({
            Amt: '19',
            BarCode: '11202FF000000011440',
            BuyerAddress: '',
            BuyerEmail: 'user@rytass.com',
            BuyerName: 'Tester',
            BuyerPhone: '',
            BuyerUBN: '',
            CarrierNum: '',
            CarrierType: '',
            Category: 'B2C',
            CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&InvoiceTransNo=23020318530290616&MerchantID=${MERCHANT_ID}&MerchantOrderNo=90h31g023476g234g&RandomNum=1440&TotalAmt=20&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
            CreateStatusTime: '',
            CreateTime: '2023-02-03 18:53:02',
            InvoiceNumber: 'FF00000001',
            InvoiceStatus: '1',
            InvoiceTransNo: '23020318530290616',
            InvoiceType: '07',
            ItemDetail: JSON.stringify([{
              ItemAmount: '20',
              ItemCount: '2',
              ItemName: '橡皮擦',
              ItemNum: '1',
              ItemPrice: '10',
              ItemRemark: '',
              ItemTaxType: '',
              ItemWord: '式',
              RelateNumber: '',
            }]),
            KioskPrintFlag: '',
            LoveCode: '',
            MerchantID: '31090553',
            MerchantOrderNo: '90h31g023476g234g',
            PrintFlag: 'Y',
            QRcodeL: 'FF000000011120203144000000013000000140000000001012145GQVWH99zBlXEGWDbB0LloA==:**********:1:1:1:橡皮擦:2:10',
            QRcodeR: '**',
            RandomNum: '1440',
            TaxAmt: '1',
            TaxRate: '0.05000',
            TaxType: '3',
            TotalAmt: '20',
            UploadStatus: '1',
          }),
        },
      };
    });

    const invoice = await gateway.query({
      orderId: '90h31g023476g234g',
      amount: 200,
    });

    expect(invoice.taxType).toBe(TaxType.TAX_FREE);
  });

  it('should query mixed tax invoice with orderId', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      expect(url).toMatch(/\/Api\/invoice_search$/);

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

      const params = new URLSearchParams([
        decipher.update(payload.PostData_, 'hex', 'utf8'),
        decipher.final('utf8'),
      ].join(''));

      expect(params.get('RespondType')).toBe('JSON');
      expect(params.get('Version')).toBe('1.3');
      expect(params.get('MerchantOrderNo')).toBe('90h31g023476g234g');
      expect(params.get('TotalAmt')).toBe('200');

      return {
        data: {
          MerchantID: MERCHANT_ID,
          Status: 'SUCCESS',
          Result: JSON.stringify({
            Amt: '19',
            BarCode: '11202FF000000011440',
            BuyerAddress: '',
            BuyerEmail: 'user@rytass.com',
            BuyerName: 'Tester',
            BuyerPhone: '',
            BuyerUBN: '',
            CarrierNum: '',
            CarrierType: '',
            Category: 'B2C',
            CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&InvoiceTransNo=23020318530290616&MerchantID=${MERCHANT_ID}&MerchantOrderNo=90h31g023476g234g&RandomNum=1440&TotalAmt=50&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
            CreateStatusTime: '',
            CreateTime: '2023-02-03 18:53:02',
            InvoiceNumber: 'FF00000001',
            InvoiceStatus: '1',
            InvoiceTransNo: '23020318530290616',
            InvoiceType: '07',
            ItemDetail: JSON.stringify([{
              ItemAmount: '20',
              ItemCount: '2',
              ItemName: '橡皮擦',
              ItemNum: '1',
              ItemPrice: '10',
              ItemRemark: '',
              ItemTaxType: '1',
              ItemWord: '式',
              RelateNumber: '',
            }, {
              ItemAmount: '20',
              ItemCount: '2',
              ItemName: '免稅橡皮擦',
              ItemNum: '1',
              ItemPrice: '10',
              ItemRemark: '',
              ItemTaxType: '3',
              ItemWord: '式',
              RelateNumber: '',
            }, {
              ItemAmount: '10',
              ItemCount: '1',
              ItemName: '零税橡皮擦',
              ItemNum: '1',
              ItemPrice: '10',
              ItemRemark: '',
              ItemTaxType: '2',
              ItemWord: '式',
              RelateNumber: '',
            }]),
            KioskPrintFlag: '',
            LoveCode: '',
            MerchantID: '31090553',
            MerchantOrderNo: '90h31g023476g234g',
            PrintFlag: 'Y',
            QRcodeL: 'FF000000011120203144000000013000000140000000001012145GQVWH99zBlXEGWDbB0LloA==:**********:1:1:1:橡皮擦:2:10',
            QRcodeR: '**',
            RandomNum: '1440',
            TaxAmt: '1',
            TaxRate: '0.05000',
            TaxType: '9',
            TotalAmt: '50',
            UploadStatus: '1',
          }),
        },
      };
    });

    const invoice = await gateway.query({
      orderId: '90h31g023476g234g',
      amount: 200,
    });

    expect(invoice.taxType).toBe(TaxType.MIXED);
    expect(invoice.items[0].taxType).toBe(TaxType.TAXED);
    expect(invoice.items[1].taxType).toBe(TaxType.TAX_FREE);
    expect(invoice.items[2].taxType).toBe(TaxType.ZERO_TAX);
  });

  it('should throw on check code invalid', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      return {
        data: {
          MerchantID: MERCHANT_ID,
          Status: 'SUCCESS',
          Result: JSON.stringify({
            Amt: '19',
            BarCode: '11202FF000000011440',
            BuyerAddress: '',
            BuyerEmail: 'user@rytass.com',
            BuyerName: 'Tester',
            BuyerPhone: '',
            BuyerUBN: '',
            CarrierNum: '',
            CarrierType: '',
            Category: 'B2C',
            CheckCode: createHash('sha256').update(`1HashIV=${AES_IV}&InvoiceTransNo=23020318530290616&MerchantID=${MERCHANT_ID}&MerchantOrderNo=90h31g023476g234g&RandomNum=1440&TotalAmt=20&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
            CreateStatusTime: '',
            CreateTime: '2023-02-03 18:53:02',
            InvoiceNumber: 'FF00000001',
            InvoiceStatus: '1',
            InvoiceTransNo: '23020318530290616',
            InvoiceType: '07',
            ItemDetail: JSON.stringify([{
              ItemAmount: '20',
              ItemCount: '2',
              ItemName: '橡皮擦',
              ItemNum: '1',
              ItemPrice: '10',
              ItemRemark: '',
              ItemTaxType: '',
              ItemWord: '式',
              RelateNumber: '',
            }]),
            KioskPrintFlag: '',
            LoveCode: '',
            MerchantID: '31090553',
            MerchantOrderNo: '90h31g023476g234g',
            PrintFlag: 'Y',
            QRcodeL: 'FF000000011120203144000000013000000140000000001012145GQVWH99zBlXEGWDbB0LloA==:**********:1:1:1:橡皮擦:2:10',
            QRcodeR: '**',
            RandomNum: '1440',
            TaxAmt: '1',
            TaxRate: '0.05000',
            TaxType: '1',
            TotalAmt: '20',
            UploadStatus: '1',
          }),
        },
      };
    });

    expect(() => gateway.query({
      orderId: '90h31g023476g234g',
      amount: 200,
    })).rejects.toThrowError('Invalid CheckCode');
  });

  it('should throw on item parse failed', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      return {
        data: {
          MerchantID: MERCHANT_ID,
          Status: 'SUCCESS',
          Result: JSON.stringify({
            Amt: '19',
            BarCode: '11202FF000000011440',
            BuyerAddress: '',
            BuyerEmail: 'user@rytass.com',
            BuyerName: 'Tester',
            BuyerPhone: '',
            BuyerUBN: '',
            CarrierNum: '',
            CarrierType: '',
            Category: 'B2C',
            CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&InvoiceTransNo=23020318530290616&MerchantID=${MERCHANT_ID}&MerchantOrderNo=90h31g023476g234g&RandomNum=1440&TotalAmt=20&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
            CreateStatusTime: '',
            CreateTime: '2023-02-03 18:53:02',
            InvoiceNumber: 'FF00000001',
            InvoiceStatus: '1',
            InvoiceTransNo: '23020318530290616',
            InvoiceType: '07',
            ItemDetail: `${JSON.stringify([{
              ItemAmount: '20',
              ItemCount: '2',
              ItemName: '橡皮擦',
              ItemNum: '1',
              ItemPrice: '10',
              ItemRemark: '',
              ItemTaxType: '',
              ItemWord: '式',
              RelateNumber: '',
            }])}::`,
            KioskPrintFlag: '',
            LoveCode: '',
            MerchantID: '31090553',
            MerchantOrderNo: '90h31g023476g234g',
            PrintFlag: 'Y',
            QRcodeL: 'FF000000011120203144000000013000000140000000001012145GQVWH99zBlXEGWDbB0LloA==:**********:1:1:1:橡皮擦:2:10',
            QRcodeR: '**',
            RandomNum: '1440',
            TaxAmt: '1',
            TaxRate: '0.05000',
            TaxType: '1',
            TotalAmt: '20',
            UploadStatus: '1',
          }),
        },
      };
    });

    expect(() => gateway.query({
      orderId: '90h31g023476g234g',
      amount: 200,
    })).rejects.toThrowError('Item Parse Failed');
  });

  it('should throw error on gateway failed', async () => {
    const mockPost = jest.spyOn(axios, 'post');

    mockPost.mockImplementation(async (url: string, data: any) => {
      return {
        data: {
          MerchantID: MERCHANT_ID,
          Status: 'FAILED',
          Result: '',
        },
      };
    });

    expect(() => gateway.query({
      orderId: '90h31g023476g234g',
      amount: 200,
    })).rejects.toThrow();
  });
});
