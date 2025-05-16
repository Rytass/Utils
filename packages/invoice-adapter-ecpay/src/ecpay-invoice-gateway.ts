import {
  CustomsMark,
  getTaxTypeFromItems,
  InvoiceAllowanceState,
  InvoiceCarrierType,
  InvoiceGateway,
  InvoiceMobileCarrier,
  InvoiceMoicaCarrier,
  TaxType,
} from '@rytass/invoice';
import axios from 'axios';
import isEmail from 'validator/lib/isEmail';
import { DateTime } from 'luxon';
import { createCipheriv, createDecipheriv } from 'crypto';
import {
  ECPayCarrierTypeCode,
  ECPayCustomsMark,
  ECPayTaxTypeCode,
  ECPAY_INVOICE_SUCCESS_CODE,
  ECPAY_COMPRESSED_ITEM_NAME,
  ECPAY_RANDOM_CODE,
} from './constants';
import {
  ECPayAllowanceInvoiceResponseDecrypted,
  ECPayBaseUrls,
  ECPayInvalidAllowanceInvoiceResponseDecrypted,
  ECPayInvoiceAllowanceOptions,
  ECPayInvoiceAllowanceRequestBody,
  ECPayInvoiceGatewayOptions,
  ECPayInvoiceGUIValidateRequestBody,
  ECPayInvoiceGUIValidateResponse,
  ECPayInvoiceInvalidAllowanceRequestBody,
  ECPayInvoiceIssueOptions,
  ECPayInvoiceListQueryOptions,
  ECPayInvoiceListQueryRequestBody,
  ECPayInvoiceLoveCodeValidateRequestBody,
  ECPayInvoiceLoveCodeValidateResponse,
  ECPayInvoiceMobileBarcodeValidateRequestBody,
  ECPayInvoiceMobileBarcodeValidateResponse,
  ECPayInvoiceQueryOptions,
  ECPayInvoiceQueryRequestBody,
  ECPayInvoiceRequestBody,
  ECPayInvoiceResponse,
  ECPayInvoiceVoidOptions,
  ECPayInvoiceVoidRequestBody,
  ECPayInvoiceVoidResponse,
  ECPayIssuedInvoiceResponse,
  ECPayPaymentItem,
  ECPayQueryInvoiceResponse,
  ECPayQueryInvoiceResponseDecrypted,
  ECPayQueryListInvoiceResponse,
  ECPayVoidInvoiceResponseDecrypted,
} from './typings';
import { ECPayInvoice } from './ecpay-invoice';
import { ECPayInvoiceAllowance } from './ecpay-allowance';

export class ECPayInvoiceGateway
  implements
    InvoiceGateway<ECPayPaymentItem, ECPayInvoice, ECPayInvoiceQueryOptions>
{
  private readonly revision = '3.0.0';
  private readonly aesIv: string = 'q9jcZX8Ib9LM8wYk';
  private readonly aesKey: string = 'ejCk326UnaZWKisg';
  private readonly merchantId: string = '2000132';
  private readonly baseUrl: string = ECPayBaseUrls.DEVELOPMENT;
  private readonly skipMobileBarcodeValidation: boolean = false;
  private readonly skipLoveCodeValidation: boolean = false;

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
        ].join(''),
      ),
    );
  }

  async isValidGUI(gui: string): Promise<[false] | [true, string]> {
    if (!/^\d{8}$/.test(gui)) {
      return [false];
    }

    console.warn(
      'GUI validation is not fully covered all companies or organization, this is a supporting feature to help you validate GUI format.',
    );

    const { data } = await axios.post<ECPayInvoiceResponse>(
      `${this.baseUrl}/B2CInvoice/GetCompanyNameByTaxID`,
      JSON.stringify({
        MerchantID: this.merchantId,
        RqHeader: {
          Timestamp: Math.round(Date.now() / 1000),
        },
        Data: this.encrypt<ECPayInvoiceGUIValidateRequestBody>({
          MerchantID: this.merchantId,
          UnifiedBusinessNo: gui,
        }),
      }),
    );

    if (data.TransCode !== ECPAY_INVOICE_SUCCESS_CODE) {
      throw new Error('Invalid Response on GUI Validator');
    }

    const payload = this.decrypt(data.Data) as ECPayInvoiceGUIValidateResponse;

    if (payload.RtnCode !== ECPAY_INVOICE_SUCCESS_CODE) {
      return [false];
    }

    return [true, payload.CompanyName];
  }

  async isLoveCodeValid(loveCode: string): Promise<boolean> {
    const { data } = await axios.post<ECPayInvoiceResponse>(
      `${this.baseUrl}/B2CInvoice/CheckLoveCode`,
      JSON.stringify({
        MerchantID: this.merchantId,
        RqHeader: {
          Timestamp: Math.round(Date.now() / 1000),
          Revision: this.revision,
        },
        Data: this.encrypt<ECPayInvoiceLoveCodeValidateRequestBody>({
          MerchantID: this.merchantId,
          LoveCode: loveCode,
        }),
      }),
    );

    if (data.TransCode !== ECPAY_INVOICE_SUCCESS_CODE) {
      throw new Error('Invalid Response on Love Code Validator');
    }

    const payload = this.decrypt(
      data.Data,
    ) as ECPayInvoiceLoveCodeValidateResponse;

    if (payload.RtnCode !== ECPAY_INVOICE_SUCCESS_CODE) {
      throw new Error('Invalid Response on Love Code Validator');
    }

    return payload.IsExist === 'Y';
  }

  async isMobileBarcodeValid(barcode: string): Promise<boolean> {
    if (!/^\/[0-9A-Z+\-.]{7}$/.test(barcode)) {
      return false;
    }

    const { data } = await axios.post<ECPayInvoiceResponse>(
      `${this.baseUrl}/B2CInvoice/CheckBarcode`,
      JSON.stringify({
        MerchantID: this.merchantId,
        RqHeader: {
          Timestamp: Math.round(Date.now() / 1000),
          Revision: this.revision,
        },
        Data: this.encrypt<ECPayInvoiceMobileBarcodeValidateRequestBody>({
          MerchantID: this.merchantId,
          BarCode: barcode,
        }),
      }),
    );

    if (data.TransCode !== ECPAY_INVOICE_SUCCESS_CODE) {
      throw new Error('Invalid Response on Mobile Barcode Validator');
    }

    const payload = this.decrypt(
      data.Data,
    ) as ECPayInvoiceMobileBarcodeValidateResponse;

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
    this.skipMobileBarcodeValidation =
      options?.skipMobileBarcodeValidation ?? false;
    this.skipLoveCodeValidation = options?.skipLoveCodeValidation ?? false;
  }

  async issue(options: ECPayInvoiceIssueOptions): Promise<ECPayInvoice> {
    if (/[^0-9a-z]/gi.test(options.orderId)) {
      throw new Error('`orderId` only allowed number and alphabet');
    }

    if (!options.orderId || options.orderId.length > 30) {
      throw new Error('`orderId` is required and length less than 30');
    }

    if (options.vatNumber && !/^\d{8}$/.test(options.vatNumber)) {
      throw new Error('Invalid VAT number format');
    }

    if (options.customer.id) {
      if (options.customer.id.length > 20)
        throw new Error('`customer.id` max length is 20');
      if (/[0-9a-z_]/gi.test(options.customer.id))
        throw new Error(
          '`customer.id` only allowed number, alphabets and underline',
        );
    }

    if (!options.customer.mobile && !options.customer.email)
      throw new Error(
        '`customer.mobile` and `customers.email` should provide one',
      );

    if (options.vatNumber && !options.customer.name) {
      throw new Error(
        '`customer.name` require the company name if `vatNumber` provided',
      );
    }

    if (options.carrier?.type === InvoiceCarrierType.PRINT) {
      if (!options.customer.name)
        throw new Error('`customer.name` is required if invoice printed');
      if (!options.customer.address)
        throw new Error('`customer.address` is required if invoice printed');
    }

    if (options.customer.email && !isEmail(options.customer.email)) {
      throw new Error('`customer.email` is invalid format');
    }

    if (options.customer.mobile && !/^\d+$/.test(options.customer.mobile)) {
      throw new Error('`customer.mobile` only allowed number');
    }

    if (
      options.vatNumber &&
      options.carrier?.type !== InvoiceCarrierType.PRINT
    ) {
      throw new Error('when `vatNumber` provided, carrier should be PRINT');
    }

    if (options.carrier?.type === InvoiceCarrierType.LOVE_CODE) {
      // validate love code
      if (
        !this.skipLoveCodeValidation &&
        !(await this.isLoveCodeValid(options.carrier.code))
      ) {
        throw new Error('Love code is invalid');
      }
    }

    if (options.carrier?.type === InvoiceCarrierType.MOBILE) {
      // validate mobile
      if (
        !this.skipMobileBarcodeValidation &&
        !(await this.isMobileBarcodeValid(options.carrier.code))
      ) {
        throw new Error('Mobile barcode is invalid');
      }
    }

    if (
      options.carrier?.type === InvoiceCarrierType.MOICA &&
      !/^[A-Z]{2}[0-9]{14}$/.test(options.carrier.code)
    ) {
      throw new Error('invalid MOICA code');
    }

    const taxType = getTaxTypeFromItems(options.items);

    if (taxType === TaxType.SPECIAL && !options.specialTaxCode) {
      throw new Error(
        '`specialTaxCode` is required if special tax item provided',
      );
    }

    const now = Math.round(Date.now() / 1000);

    const amount = options.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    if (amount <= 0) {
      throw new Error('invoice amount should more than zero');
    }

    const { data } = await axios.post<ECPayInvoiceResponse>(
      `${this.baseUrl}/B2CInvoice/Issue`,
      JSON.stringify({
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
          ClearanceMark:
            ECPayCustomsMark[options.customsMark ?? CustomsMark.NO],
          Print: options.carrier?.type === InvoiceCarrierType.PRINT ? '1' : '0',
          Donation:
            options.carrier?.type === InvoiceCarrierType.LOVE_CODE ? '1' : '0',
          LoveCode:
            options.carrier?.type === InvoiceCarrierType.LOVE_CODE
              ? options.carrier.code
              : '',
          CarrierType:
            ECPayCarrierTypeCode[
              options.carrier?.type ?? InvoiceCarrierType.PRINT
            ],
          CarrierNum: ~['2', '3'].indexOf(
            ECPayCarrierTypeCode[
              options.carrier?.type ?? InvoiceCarrierType.PRINT
            ],
          )
            ? (options.carrier as InvoiceMobileCarrier | InvoiceMoicaCarrier)
                .code
            : '',
          TaxType: ECPayTaxTypeCode[taxType],
          SpecialTaxType: ~[
            TaxType.TAXED,
            TaxType.TAX_FREE,
            TaxType.MIXED,
          ].indexOf(taxType)
            ? 0
            : taxType === TaxType.ZERO_TAX
              ? 8
              : options.specialTaxCode,
          SalesAmount: amount,
          InvoiceRemark: options.remark ?? '',
          Items: options.items.map((item, index) => ({
            ItemSeq: index + 1,
            ItemName: item.name,
            ItemCount: item.quantity,
            ItemWord: item.unit ?? '個',
            ItemPrice: item.unitPrice,
            ItemTaxType:
              !item.taxType || item.taxType === TaxType.SPECIAL
                ? ECPayTaxTypeCode[TaxType.TAXED]
                : ECPayTaxTypeCode[item.taxType as TaxType],
            ItemAmount: item.quantity * item.unitPrice,
            ItemRemark: item.remark ?? null,
          })),
          InvType: taxType === TaxType.SPECIAL ? '08' : '07',
          vat: '1',
        } as ECPayInvoiceRequestBody),
      }),
    );

    if (data.TransCode === ECPAY_INVOICE_SUCCESS_CODE) {
      const payload = this.decrypt<ECPayIssuedInvoiceResponse>(data.Data);

      if (payload.RtnCode !== ECPAY_INVOICE_SUCCESS_CODE) {
        throw new Error('ECPay issue failed');
      }

      return new ECPayInvoice({
        items: options.items,
        issuedOn: DateTime.fromFormat(
          payload.InvoiceDate,
          'yyyy-MM-dd+HH:mm:ss',
        ).toJSDate(),
        invoiceNumber: payload.InvoiceNo,
        randomCode: payload.RandomNumber,
        orderId: options.orderId,
        taxType,
      });
    }

    throw new Error('ECPay gateway error');
  }

  async void(
    invoice: ECPayInvoice,
    options: ECPayInvoiceVoidOptions,
  ): Promise<ECPayInvoice> {
    const now = Math.round(Date.now() / 1000);

    const { data } = await axios.post<ECPayInvoiceVoidResponse>(
      `${this.baseUrl}/B2CInvoice/Invalid`,
      JSON.stringify({
        MerchantID: this.merchantId,
        RqHeader: {
          Timestamp: now,
          Revision: this.revision,
        },
        Data: this.encrypt<ECPayInvoiceVoidRequestBody>({
          MerchantID: this.merchantId,
          InvoiceNo: invoice.invoiceNumber,
          InvoiceDate: DateTime.fromJSDate(invoice.issuedOn).toFormat(
            'yyyy-MM-dd',
          ),
          Reason: options.reason,
        }),
      }),
    );

    if (data.TransCode === ECPAY_INVOICE_SUCCESS_CODE) {
      const payload = this.decrypt<ECPayVoidInvoiceResponseDecrypted>(
        data.Data,
      );

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

  async allowance(
    invoice: ECPayInvoice,
    allowanceItems: ECPayPaymentItem[],
    options?: ECPayInvoiceAllowanceOptions,
  ): Promise<ECPayInvoice> {
    if (invoice.taxType === TaxType.MIXED && !options?.taxType) {
      throw new Error('Mixed invoice allowance must specify a tax type');
    }

    const now = Math.round(Date.now() / 1000);

    const totalAmount = allowanceItems.reduce(
      (acc, item) => acc + item.quantity * item.unitPrice,
      0,
    );

    const { data } = await axios.post<ECPayInvoiceVoidResponse>(
      `${this.baseUrl}/B2CInvoice/Allowance`,
      JSON.stringify({
        MerchantID: this.merchantId,
        RqHeader: {
          Timestamp: now,
          Revision: this.revision,
        },
        Data: this.encrypt<ECPayInvoiceAllowanceRequestBody>({
          MerchantID: this.merchantId,
          InvoiceNo: invoice.invoiceNumber,
          InvoiceDate: DateTime.fromJSDate(invoice.issuedOn).toFormat(
            'yyyy-MM-dd',
          ),
          AllowanceNotify: (() => {
            if (options?.notifyEmail) {
              if (options?.notifyPhone) {
                return 'A';
              }

              return 'E';
            }

            if (options?.notifyPhone) {
              return 'S';
            }

            return 'N';
          })(),
          CustomerName: options?.buyerName ?? '',
          NotifyMail: options?.notifyEmail,
          NotifyPhone: options?.notifyPhone,
          AllowanceAmount: totalAmount,
          Items: allowanceItems.map((item, index) => ({
            ItemSeq: index + 1,
            ItemName: item.name,
            ItemCount: item.quantity,
            ItemWord: item.unit ?? '式',
            ItemPrice: item.unitPrice,
            ...(invoice.taxType === TaxType.MIXED
              ? {
                  ItemTaxType: (() => {
                    switch (options?.taxType) {
                      case TaxType.TAXED:
                        return '1';

                      case TaxType.ZERO_TAX:
                        return '2';

                      case TaxType.TAX_FREE:
                        return '3';
                    }
                  })(),
                }
              : {}),
            ItemAmount: item.quantity * item.unitPrice,
          })),
        }),
      }),
    );

    if (data.TransCode === ECPAY_INVOICE_SUCCESS_CODE) {
      const payload = this.decrypt<ECPayAllowanceInvoiceResponseDecrypted>(
        data.Data,
      );

      if (payload.RtnCode !== ECPAY_INVOICE_SUCCESS_CODE) {
        throw new Error(`ECPay allowance failed: (${payload.RtnMsg})`);
      }

      const allowance = new ECPayInvoiceAllowance({
        allowanceNumber: payload.IA_Allow_No,
        allowancePrice: totalAmount,
        allowancedOn: DateTime.fromFormat(
          payload.IA_Date,
          'yyyy-MM-dd HH:mm:ss',
        ).toJSDate(),
        remainingAmount: payload.IA_Remain_Allowance_Amt,
        items: allowanceItems,
        parentInvoice: invoice,
        status: InvoiceAllowanceState.ISSUED,
      });

      invoice.addAllowance(allowance);

      return invoice;
    }

    throw new Error('ECPay gateway error');
  }

  async invalidAllowance(
    allowance: ECPayInvoiceAllowance,
    reason?: string,
  ): Promise<ECPayInvoice> {
    const now = Math.round(Date.now() / 1000);

    const { data } = await axios.post<ECPayInvoiceVoidResponse>(
      `${this.baseUrl}/B2CInvoice/AllowanceInvalid`,
      JSON.stringify({
        MerchantID: this.merchantId,
        RqHeader: {
          Timestamp: now,
          Revision: this.revision,
        },
        Data: this.encrypt<ECPayInvoiceInvalidAllowanceRequestBody>({
          MerchantID: this.merchantId,
          InvoiceNo: allowance.parentInvoice.invoiceNumber,
          AllowanceNo: allowance.allowanceNumber,
          Reason: reason ?? '作廢折讓',
        }),
      }),
    );

    if (data.TransCode === ECPAY_INVOICE_SUCCESS_CODE) {
      const payload =
        this.decrypt<ECPayInvalidAllowanceInvoiceResponseDecrypted>(data.Data);

      if (payload.RtnCode !== ECPAY_INVOICE_SUCCESS_CODE) {
        throw new Error(`ECPay allowance failed: (${payload.RtnMsg})`);
      }

      allowance.invalid();

      return allowance.parentInvoice;
    }

    throw new Error('ECPay gateway error');
  }

  async query(options: ECPayInvoiceQueryOptions): Promise<ECPayInvoice> {
    const now = Math.round(Date.now() / 1000);

    const { data } = await axios.post<ECPayQueryInvoiceResponse>(
      `${this.baseUrl}/B2CInvoice/GetIssue`,
      JSON.stringify({
        MerchantID: this.merchantId,
        RqHeader: {
          Timestamp: now,
        },
        Data: this.encrypt<ECPayInvoiceQueryRequestBody>({
          MerchantID: this.merchantId,
          ...('orderId' in options
            ? {
                RelateNumber: options.orderId,
              }
            : {
                InvoiceNo: options.invoiceNumber,
                InvoiceDate: DateTime.fromJSDate(options.issuedOn).toFormat(
                  'yyyy-MM-dd',
                ),
              }),
        }),
      }),
    );

    if (data.TransCode === ECPAY_INVOICE_SUCCESS_CODE) {
      const payload = this.decrypt<ECPayQueryInvoiceResponseDecrypted>(
        data.Data,
      );

      if (payload.RtnCode !== ECPAY_INVOICE_SUCCESS_CODE) {
        throw new Error(`ECPay query failed: (${payload.RtnMsg})`);
      }

      return new ECPayInvoice({
        items: payload.Items.map((item) => ({
          name: item.ItemName,
          unitPrice: item.ItemPrice,
          quantity: item.ItemCount,
          unit: item.ItemWord,
          taxType: ((taxType) => {
            switch (taxType) {
              case '1':
                return TaxType.TAXED;

              case '2':
                return TaxType.ZERO_TAX;

              case '3':
                return TaxType.TAX_FREE;

              default:
                return undefined;
            }
          })(item.ItemTaxType),
          remark: item.ItemRemark,
        })),
        issuedOn: DateTime.fromFormat(
          payload.IIS_Create_Date,
          'yyyy-MM-dd+HH:mm:ss',
        ).toJSDate(),
        isVoid: payload.IIS_Invalid_Status === '1',
        invoiceNumber: payload.IIS_Number,
        randomCode: payload.IIS_Random_Number,
        orderId: payload.IIS_Relate_Number,
        awardType: Number(payload.IIS_Award_Type),
        taxType: ((taxType) => {
          switch (taxType) {
            case '1':
              return TaxType.TAXED;

            case '2':
              return TaxType.ZERO_TAX;

            case '3':
              return TaxType.TAX_FREE;

            case '4':
              return TaxType.SPECIAL;

            case '9':
              return TaxType.MIXED;
          }
        })(payload.IIS_Tax_Type),
      });
    }

    throw new Error('ECPay gateway error');
  }

  private async getInvoiceListInPage(
    options: ECPayInvoiceListQueryOptions,
    page: number,
  ): Promise<ECPayInvoice[]> {
    const now = Math.round(Date.now() / 1000);

    const { data } = await axios.post<ECPayQueryListInvoiceResponse>(
      `${this.baseUrl}/B2CInvoice/GetIssueList`,
      JSON.stringify({
        MerchantID: this.merchantId,
        RqHeader: {
          Timestamp: now,
        },
        Data: this.encrypt<ECPayInvoiceListQueryRequestBody>({
          MerchantID: this.merchantId,
          BeginDate: options.startDate,
          EndDate: options.endDate,
          NumPerPage: 200,
          ShowingPage: page,
          DataType: 1,
          Query_Award: options.onlyAward ? 1 : 0,
          Query_Invalid: options.onlyInvalid ? 1 : 0,
        }),
      }),
    );

    if (data.TransCode === ECPAY_INVOICE_SUCCESS_CODE) {
      return data.Data.InvoiceData.map(
        (invoice) =>
          new ECPayInvoice({
            items: [
              {
                name: ECPAY_COMPRESSED_ITEM_NAME,
                unitPrice: invoice.IIS_Sales_Amount,
                quantity: 1,
                unit: '式',
                taxType: ((taxType) => {
                  switch (taxType) {
                    case '2':
                      return TaxType.ZERO_TAX;

                    case '3':
                      return TaxType.TAX_FREE;

                    case '4':
                      return TaxType.SPECIAL;

                    case '1':
                    default:
                      return TaxType.TAXED;
                  }
                })(invoice.IIS_Tax_Type),
                remark: '',
              },
            ],
            issuedOn: DateTime.fromFormat(
              invoice.IIS_Create_Date,
              'yyyy-MM-dd HH:mm:ss',
            ).toJSDate(),
            isVoid: invoice.IIS_Invalid_Status === '1',
            invoiceNumber: invoice.IIS_Number,
            randomCode: ECPAY_RANDOM_CODE,
            orderId: invoice.IIS_Relate_Number,
            awardType: Number(invoice.IIS_Award_Type),
            taxType: ((taxType) => {
              switch (taxType) {
                case '2':
                  return TaxType.ZERO_TAX;

                case '3':
                  return TaxType.TAX_FREE;

                case '4':
                  return TaxType.SPECIAL;

                case '9':
                  return TaxType.MIXED;

                case '1':
                default:
                  return TaxType.TAXED;
              }
            })(invoice.IIS_Tax_Type),
          }),
      );
    }

    throw new Error('ECPay gateway error');
  }

  async list(options: ECPayInvoiceListQueryOptions): Promise<ECPayInvoice[]> {
    const getData = async (
      allInvoices: ECPayInvoice[] = [],
      page = 1,
    ): Promise<ECPayInvoice[]> => {
      const invoices = await this.getInvoiceListInPage(options, page);

      if (invoices.length === 0) return allInvoices;

      if (invoices.length < 200) {
        return [...allInvoices, ...invoices];
      }

      return getData([...allInvoices, ...invoices], page + 1);
    };

    return getData();
  }
}
