import { CustomsMark, getTaxTypeFromItems, InvoiceCarrierType, InvoiceGateway, InvoiceMobileCarrier, InvoiceMoicaCarrier, InvoiceVoidOptions, TaxType } from '@rytass/invoice';
import axios from 'axios';
import isEmail from 'validator/lib/isEmail';
import { DateTime } from 'luxon';
import { createCipheriv, createDecipheriv } from 'crypto';
import {
  ECPayCarrierTypeCode,
  ECPayCustomsMark,
  ECPayTaxTypeCode,
  ECPAY_INVOICE_SUCCESS_CODE,
} from './constants';
import {
  ECPayInvoiceGatewayOptions,
  ECPayInvoiceIssueOptions,
  ECPayInvoiceLoveCodeValidateRequestBody,
  ECPayInvoiceLoveCodeValidateResponse,
  ECPayInvoiceMobileBarcodeValidateRequestBody,
  ECPayInvoiceMobileBarcodeValidateResponse,
  ECPayInvoiceRequestBody,
  ECPayInvoiceResponse,
  ECPayInvoiceVoidOptions,
  ECPayInvoiceVoidRequestBody,
  ECPayInvoiceVoidResponse,
  ECPayIssuedInvoiceResponse,
  ECPayVoidInvoiceResponseDecrypted,
} from './typings';
import {
  ECPayInvoice,
} from './ecpay-invoice';

export class ECPayInvoiceGateway implements InvoiceGateway<ECPayInvoice> {
  private readonly revision = '3.0.0';
  private readonly aesIv: string = 'q9jcZX8Ib9LM8wYk';
  private readonly aesKey: string = 'ejCk326UnaZWKisg';
  private readonly merchantId: string = '2000132';
  private readonly baseUrl: string = 'https://einvoice-stage.ecpay.com.tw';

  private encrypt<T>(data: T): string {
    const encodedData = encodeURIComponent(JSON.stringify(data));

    const cipher = createCipheriv('aes-128-cbc', this.aesKey, this.aesIv);

    cipher.setAutoPadding(true);

    return [
      cipher.update(encodedData, 'utf8', 'base64'),
      cipher.final('base64'),
    ].join('');
  }

  private decrypt<T>(encryptedData: string): T {
    const decipher = createDecipheriv('aes-128-cbc', this.aesKey, this.aesIv);

    return JSON.parse(
      decodeURIComponent(
        [
          decipher.update(encryptedData, 'base64', 'utf8'),
          decipher.final('utf8'),
        ].join('')
      )
    );
  }

  async isLoveCodeValid(loveCode: string): Promise<boolean> {
    const { data } = await axios.post<ECPayInvoiceResponse>(`${this.baseUrl}/B2CInvoice/CheckLoveCode`, JSON.stringify({
      MerchantID: this.merchantId,
      RqHeader: {
        Timestamp: Math.round(Date.now() / 1000),
        Revision: this.revision,
      },
      Data: this.encrypt<ECPayInvoiceLoveCodeValidateRequestBody>({
        MerchantID: this.merchantId,
        LoveCode: loveCode,
      }),
    }));

    if (data.TransCode !== ECPAY_INVOICE_SUCCESS_CODE) {
      throw new Error('Invalid Response on Love Code Validator');
    }

    const payload = this.decrypt(data.Data) as ECPayInvoiceLoveCodeValidateResponse;

    if (payload.RtnCode !== ECPAY_INVOICE_SUCCESS_CODE) {
      throw new Error('Invalid Response on Love Code Validator');
    }

    return payload.IsExist === 'Y';
  }

  async isMobileBarcodeValid(barcode: string): Promise<boolean> {
    const { data } = await axios.post<ECPayInvoiceResponse>(`${this.baseUrl}/B2CInvoice/CheckBarcode`, JSON.stringify({
      MerchantID: this.merchantId,
      RqHeader: {
        Timestamp: Math.round(Date.now() / 1000),
        Revision: this.revision,
      },
      Data: this.encrypt<ECPayInvoiceMobileBarcodeValidateRequestBody>({
        MerchantID: this.merchantId,
        BarCode: barcode,
      }),
    }));

    if (data.TransCode !== ECPAY_INVOICE_SUCCESS_CODE) {
      throw new Error('Invalid Response on Mobile Barcode Validator');
    }

    const payload = this.decrypt(data.Data) as ECPayInvoiceMobileBarcodeValidateResponse;

    if (payload.RtnCode !== ECPAY_INVOICE_SUCCESS_CODE) {
      throw new Error('Invalid Response on Mobile Barcode Validator');
    }

    return payload.IsExist === 'Y';
  }

  constructor(options?: ECPayInvoiceGatewayOptions) {
    this.aesIv = options?.aesIv || this.aesIv;
    this.aesKey = options?.aesKey || this.aesKey;
    this.merchantId = options?.merchantId || this.merchantId;
    this.baseUrl = options?.baseUrl || this.baseUrl;
  }

  async issue(options: ECPayInvoiceIssueOptions): Promise<ECPayInvoice> {
    if (/[^0-9a-z]/ig.test(options.orderId)) {
      throw new Error('`orderId` only allowed number and alphabet');
    }

    if (!options.orderId || options.orderId.length > 30) {
      throw new Error('`orderId` is required and length less than 30');
    }

    if (options.vatNumber && !/^\d{8}$/.test(options.vatNumber)) {
      throw new Error('Invalid VAT number format');
    }

    if (options.customer.id) {
      if (options.customer.id.length > 20) throw new Error('`customer.id` max length is 20');
      if (/[0-9a-z_]/ig.test(options.customer.id)) throw new Error('`customer.id` only allowed number, alphabets and underline');
    }

    if (!options.customer.mobile && !options.customer.email) throw new Error('`customer.mobile` and `customers.email` should provide one');

    if (options.vatNumber && !options.customer.name) {
      throw new Error('`customer.name` require the company name if `vatNumber` provided');
    }

    if (options.carrier?.type === InvoiceCarrierType.PRINT) {
      if (!options.customer.name) throw new Error('`customer.name` is required if invoice printed');
      if (!options.customer.address) throw new Error('`customer.address` is required if invoice printed');
    }

    if (options.customer.email && !isEmail(options.customer.email)) {
      throw new Error('`customer.email` is invalid format');
    }

    if (options.customer.mobile && !/^\d+$/.test(options.customer.mobile)) {
      throw new Error('`customer.mobile` only allowed number');
    }

    if (options.vatNumber && options.carrier?.type !== InvoiceCarrierType.PRINT) {
      throw new Error('when `vatNumber` provided, carrier should be PRINT');
    }

    if (options.carrier?.type === InvoiceCarrierType.LOVE_CODE) {
      // validate love code
      if (!(await this.isLoveCodeValid(options.carrier.code))) {
        throw new Error('Love code is invalid');
      }
    }

    if (options.carrier?.type === InvoiceCarrierType.MOBILE) {
      // validate mobile
      if (!(await this.isMobileBarcodeValid(options.carrier.code))) {
        throw new Error('Mobile barcode is invalid');
      }
    }

    if (options.carrier?.type === InvoiceCarrierType.MOICA && !/^[A-Z]{2}[0-9]{14}$/.test(options.carrier.code)) {
      throw new Error('invalid MOICA code');
    }

    const taxType = getTaxTypeFromItems(options.items);

    if (taxType === TaxType.SPECIAL && !options.specialTaxCode) {
      throw new Error('`specialTaxCode` is required if special tax item provided');
    }

    const now = Math.round(Date.now() / 1000);

    const amount = options.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    if (amount <= 0) {
      throw new Error('invoice amount should more than zero');
    }

    const { data } = await axios.post<ECPayInvoiceResponse>(`${this.baseUrl}/B2CInvoice/Issue`, JSON.stringify({
      MerchantID: this.merchantId,
      RqHeader: {
        Timestamp: now,
        Revision: this.revision,
      },
      Data: this.encrypt<ECPayInvoiceRequestBody>({
        MerchantID: this.merchantId,
        RelateNumber: options.orderId,
        CustomerID: options.customer.id ?? '',
        CustomerIdentifier: options.vatNumber ?? '',
        CustomerName: options.customer.name ?? '',
        CustomerAddr: options.customer.address ?? '',
        CustomerPhone: options.customer.mobile ?? '',
        CustomerEmail: options.customer.email ?? '',
        ClearanceMark: ECPayCustomsMark[options.customsMark ?? CustomsMark.NO],
        Print: options.carrier?.type === InvoiceCarrierType.PRINT ? '1' : '0',
        Donation: options.carrier?.type === InvoiceCarrierType.LOVE_CODE ? '1' : '0',
        LoveCode: options.carrier?.type === InvoiceCarrierType.LOVE_CODE ? options.carrier.code : '',
        CarrierType: ECPayCarrierTypeCode[options.carrier?.type ?? InvoiceCarrierType.PRINT],
        CarrierNum: ~['2', '3'].indexOf(ECPayCarrierTypeCode[options.carrier?.type ?? InvoiceCarrierType.PRINT]) ? (options.carrier as (InvoiceMobileCarrier | InvoiceMoicaCarrier)).code : '',
        TaxType: ECPayTaxTypeCode[taxType],
        SpecialTaxType: ~[TaxType.TAXED, TaxType.TAX_FREE, TaxType.MIXED].indexOf(taxType) ? 0 : (
          taxType === TaxType.ZERO_TAX ? 8 : options.specialTaxCode
        ),
        SalesAmount: amount,
        InvoiceRemark: options.remark ?? '',
        Items: options.items.map((item, index) => ({
          ItemSeq: index + 1,
          ItemName: item.name,
          ItemCount: item.quantity,
          ItemWord: item.unit ?? '個',
          ItemPrice: item.unitPrice,
          ItemTaxType: !item.taxType || item.taxType === TaxType.SPECIAL ? ECPayTaxTypeCode[TaxType.TAXED] : ECPayTaxTypeCode[item.taxType],
          ItemAmount: item.quantity * item.unitPrice,
          ItemRemark: item.remark ?? null,
        })),
        InvType: taxType === TaxType.SPECIAL ? '08' : '07',
        vat: '1',
      } as ECPayInvoiceRequestBody),
    }));

    if (data.TransCode === ECPAY_INVOICE_SUCCESS_CODE) {
      const payload = this.decrypt<ECPayIssuedInvoiceResponse>(data.Data);

      if (payload.RtnCode !== ECPAY_INVOICE_SUCCESS_CODE) {
        throw new Error('ECPay issue failed');
      }

      return new ECPayInvoice({
        items: options.items,
        issuedOn: DateTime.fromFormat(payload.InvoiceDate, 'yyyy-MM-dd+HH:mm:ss').toJSDate(),
        invoiceNumber: payload.InvoiceNo,
        randomCode: payload.RandomNumber,
        orderId: options.orderId,
      });
    }

    throw new Error('ECPay gateway error');
  }

  async void(invoice: ECPayInvoice, options: ECPayInvoiceVoidOptions): Promise<ECPayInvoice> {
    const now = Math.round(Date.now() / 1000);

    const { data } = await axios.post<ECPayInvoiceVoidResponse>(`${this.baseUrl}/B2CInvoice/Invalid`, JSON.stringify({
      MerchantID: this.merchantId,
      RqHeader: {
        Timestamp: now,
        Revision: this.revision,
      },
      Data: this.encrypt<ECPayInvoiceVoidRequestBody>({
        MerchantID: this.merchantId,
        InvoiceNo: invoice.invoiceNumber,
        InvoiceDate: DateTime.fromJSDate(invoice.issuedOn).toFormat('yyyy-MM-dd'),
        Reason: options.reason,
      }),
    }));

    if (data.TransCode === ECPAY_INVOICE_SUCCESS_CODE) {
      const payload = this.decrypt<ECPayVoidInvoiceResponseDecrypted>(data.Data);

      if (payload.RtnCode !== ECPAY_INVOICE_SUCCESS_CODE) {
        throw new Error('ECPay issue failed');
      }

      if (payload.InvoiceNo) {
        invoice.setVoid();
      }

      return invoice;
    }

    throw new Error('ECPay gateway error');
  }
}
