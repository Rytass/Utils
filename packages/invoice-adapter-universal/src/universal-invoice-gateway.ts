import {
  CustomsMark,
  getTaxTypeFromItems,
  InvoiceAllowanceState,
  InvoiceCarrierType,
  InvoiceGateway,
  InvoiceState,
  isValidVATNumber,
  TaxType,
} from '@rytass/invoice';
import axios from 'axios';
import { createHmac } from 'crypto';
import { DateTime } from 'luxon';
import isEmail from 'validator/lib/isEmail';
import {
  UNIVERSAL_B2C_BUYER_ID,
  UNIVERSAL_DEFAULT_INVOICE_TYPE,
  UNIVERSAL_TAX_RATE,
  UniversalBaseUrls,
  UniversalTaxTypeCode,
} from './constants';
import { UniversalAllowance } from './universal-allowance';
import { UniversalInvoice } from './universal-invoice';
import {
  UniversalAllowanceDetailPayload,
  UniversalCancelAllowancePayload,
  UniversalCancelAllowanceResponse,
  UniversalCancelInvoicePayload,
  UniversalCancelInvoiceResponse,
  UniversalDetailTaxTypeCode,
  UniversalInvoiceAllowanceOptions,
  UniversalInvoiceDetailPayload,
  UniversalInvoiceGatewayOptions,
  UniversalInvoiceInvalidAllowanceOptions,
  UniversalInvoiceIssueOptions,
  UniversalInvoiceQueryOptions,
  UniversalInvoiceVoidOptions,
  UniversalOpenAllowancePayload,
  UniversalOpenAllowanceResponse,
  UniversalOpenInvoicePayload,
  UniversalOpenInvoiceResponse,
  UniversalPaymentItem,
  UniversalProcessType,
  UniversalQueryInvoiceDetailPayload,
  UniversalQueryInvoiceDetailResponse,
  UniversalQueryInvoicePayload,
  UniversalQueryInvoiceResponse,
  UniversalRequestBody,
  UniversalResponse,
  UniversalTaxTypeCodeValue,
} from './typings';

interface UniversalAmountSummary {
  salesAmount: number;
  freetaxSalesamount: number;
  zerotaxSalesamount: number;
  taxAmount: number;
  totalAmount: number;
}

export class UniversalInvoiceGateway implements InvoiceGateway<
  UniversalPaymentItem,
  UniversalInvoice,
  UniversalInvoiceQueryOptions
> {
  private readonly companyID: string;

  private readonly userID: string;

  private readonly auth: string;

  private readonly apiKey: string;

  private readonly sellerID: string;

  private readonly baseUrl: string;

  private readonly unitCode?: string;

  private readonly buyerNameResolver?: (options: UniversalInvoiceIssueOptions) => string;

  private readonly skipMobileBarcodeValidation: boolean;

  private readonly skipLoveCodeValidation: boolean;

  constructor(options: UniversalInvoiceGatewayOptions) {
    this.companyID = options.companyID;
    this.userID = options.userID;
    this.auth = options.auth;
    this.apiKey = options.apiKey;
    this.sellerID = options.sellerID;
    this.baseUrl = options.baseUrl ?? UniversalBaseUrls.DEVELOPMENT;
    this.unitCode = options.unitCode;
    this.buyerNameResolver = options.buyerNameResolver;
    this.skipMobileBarcodeValidation = options.skipMobileBarcodeValidation ?? false;
    this.skipLoveCodeValidation = options.skipLoveCodeValidation ?? false;
  }

  private createDateTime(): string {
    return DateTime.now().setZone('Asia/Taipei').toFormat('yyyyLLddHHmmss');
  }

  private createSignature(createDateTime: string): string {
    return createHmac('sha256', this.apiKey).update(createDateTime).digest('base64');
  }

  private createRequestBody<TReqData>(reqData: TReqData): UniversalRequestBody<TReqData> {
    const createDateTime = this.createDateTime();

    return {
      companyID: this.companyID,
      userID: this.userID,
      auth: Buffer.from(this.auth, 'utf8').toString('base64'),
      createDateTime,
      signatureValue: this.createSignature(createDateTime),
      reqData,
    };
  }

  private async post<TReqData, TRespData>(path: string, reqData: TReqData): Promise<TRespData> {
    const { data } = await axios.post<UniversalResponse<TRespData>>(
      `${this.baseUrl}${path}`,
      this.createRequestBody(reqData),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.statusCode !== '0') {
      throw new Error(data.statusDesc || `Universal invoice API failed with status ${data.statusCode}`);
    }

    return data.respData as TRespData;
  }

  private getProcessType(vatNumber?: string): UniversalProcessType {
    return vatNumber ? 'B' : 'C';
  }

  private getBuyerID(vatNumber?: string): string {
    return vatNumber ?? UNIVERSAL_B2C_BUYER_ID;
  }

  private getBuyerName(options: UniversalInvoiceIssueOptions): string {
    const buyerName = options.buyerName ?? this.buyerNameResolver?.(options);

    if (!buyerName || /^0{1,4}$/.test(buyerName)) {
      throw new Error('Buyer name is required and cannot be 0, 00, 000, or 0000');
    }

    if (buyerName.length > 60) {
      throw new Error('Buyer name is too long, max: 60');
    }

    return buyerName;
  }

  private getTaxRate(taxType: TaxType): number {
    if ([TaxType.TAX_FREE, TaxType.ZERO_TAX].includes(taxType)) return 0;

    return UNIVERSAL_TAX_RATE;
  }

  private getItemAmount(item: UniversalPaymentItem): number {
    return Math.round(item.unitPrice * item.quantity);
  }

  private getUntaxedAmount(item: UniversalPaymentItem, invoiceTaxType: TaxType): number {
    const itemTaxType = item.taxType ?? (invoiceTaxType === TaxType.MIXED ? TaxType.TAXED : invoiceTaxType);

    if (itemTaxType !== TaxType.TAXED && itemTaxType !== TaxType.SPECIAL) {
      return this.getItemAmount(item);
    }

    return Math.round(this.getItemAmount(item) / (1 + UNIVERSAL_TAX_RATE));
  }

  private getAmountSummary(items: UniversalPaymentItem[], taxType: TaxType): UniversalAmountSummary {
    return items.reduce(
      (summary, item) => {
        const itemTaxType = item.taxType ?? (taxType === TaxType.MIXED ? TaxType.TAXED : taxType);
        const itemTotal = this.getItemAmount(item);
        const untaxedAmount = this.getUntaxedAmount(item, taxType);
        const taxAmount = itemTotal - untaxedAmount;

        switch (itemTaxType) {
          case TaxType.TAX_FREE:
            return {
              ...summary,
              freetaxSalesamount: summary.freetaxSalesamount + itemTotal,
              totalAmount: summary.totalAmount + itemTotal,
            };

          case TaxType.ZERO_TAX:
            return {
              ...summary,
              zerotaxSalesamount: summary.zerotaxSalesamount + itemTotal,
              totalAmount: summary.totalAmount + itemTotal,
            };

          case TaxType.SPECIAL:
          case TaxType.TAXED:
          default:
            return {
              ...summary,
              salesAmount: summary.salesAmount + untaxedAmount,
              taxAmount: summary.taxAmount + taxAmount,
              totalAmount: summary.totalAmount + itemTotal,
            };
        }
      },
      {
        salesAmount: 0,
        freetaxSalesamount: 0,
        zerotaxSalesamount: 0,
        taxAmount: 0,
        totalAmount: 0,
      },
    );
  }

  private getDetailTaxType(item: UniversalPaymentItem, invoiceTaxType: TaxType): UniversalDetailTaxTypeCode {
    const taxType = item.taxType ?? (invoiceTaxType === TaxType.MIXED ? TaxType.TAXED : invoiceTaxType);

    return UniversalTaxTypeCode[taxType] as UniversalDetailTaxTypeCode;
  }

  private getIssueDetails(
    items: UniversalPaymentItem[],
    invoiceTaxType: TaxType,
    isB2B: boolean,
  ): UniversalInvoiceDetailPayload[] {
    return items.map((item, index) => {
      if (item.name.length > 500) {
        throw new Error('Item name is too long, max: 500');
      }

      if (item.unit && item.unit.length > 6) {
        throw new Error('Item unit is too long, max: 6');
      }

      if (item.remark && item.remark.length > 120) {
        throw new Error('Item remark is too long, max: 120');
      }

      const itemTaxType = item.taxType ?? (invoiceTaxType === TaxType.MIXED ? TaxType.TAXED : invoiceTaxType);
      const unitprice =
        isB2B && [TaxType.TAXED, TaxType.SPECIAL].includes(itemTaxType)
          ? Number((item.unitPrice / (1 + UNIVERSAL_TAX_RATE)).toFixed(6))
          : item.unitPrice;

      const amount = isB2B ? Number((unitprice * item.quantity).toFixed(6)) : this.getItemAmount(item);

      return {
        description: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitprice,
        amount,
        sequenceNumber: String(index + 1).padStart(4, '0'),
        remark: item.remark,
        taxType: invoiceTaxType === TaxType.MIXED ? this.getDetailTaxType(item, invoiceTaxType) : undefined,
      };
    });
  }

  private getCarrierFields(
    carrier: UniversalInvoiceIssueOptions['carrier'],
  ): Pick<
    UniversalOpenInvoicePayload,
    'carrierType' | 'carrierID1' | 'carrierID2' | 'donateMark' | 'npoban' | 'printMark'
  > {
    switch (carrier?.type) {
      case InvoiceCarrierType.MOBILE:
        return {
          carrierType: '3J0002',
          carrierID1: carrier.code,
          carrierID2: carrier.code,
          donateMark: '0',
          printMark: 'N',
        };

      case InvoiceCarrierType.MOICA:
        return {
          carrierType: 'CQ0001',
          carrierID1: carrier.code,
          carrierID2: carrier.code,
          donateMark: '0',
          printMark: 'N',
        };

      case InvoiceCarrierType.MEMBER:
      case InvoiceCarrierType.PLATFORM:
        return {
          carrierType: 'EG0478',
          carrierID1: carrier.code,
          carrierID2: carrier.code,
          donateMark: '0',
          printMark: 'N',
        };

      case InvoiceCarrierType.LOVE_CODE:
        return {
          donateMark: '1',
          npoban: carrier.code,
          printMark: 'N',
        };

      case InvoiceCarrierType.PRINT:
      default:
        return {
          donateMark: '0',
          printMark: 'Y',
        };
    }
  }

  private getInvoiceState(status?: '0' | '1' | '3'): InvoiceState {
    switch (status) {
      case '1':
        return InvoiceState.VOID;

      case '3':
        throw new Error('Universal invoice was rejected');

      case '0':
      default:
        return InvoiceState.ISSUED;
    }
  }

  private getIssuedOn(invDate: string, invTime?: string): Date {
    const normalizedTime = invTime?.replaceAll(':', '') || '000000';

    return DateTime.fromFormat(`${invDate}${normalizedTime}`, 'yyyyLLddHHmmss', { zone: 'Asia/Taipei' }).toJSDate();
  }

  private getInvoiceDate(invoice: UniversalInvoice): string {
    return DateTime.fromJSDate(invoice.issuedOn).setZone('Asia/Taipei').toFormat('yyyyLLdd');
  }

  private getTaxTypeFromDetail(response: UniversalQueryInvoiceDetailResponse): TaxType {
    if (Number(response.freetaxsalesamount ?? 0) > 0 && Number(response.amount ?? 0) > 0) return TaxType.MIXED;

    if (Number(response.zerotaxsalesamount ?? 0) > 0 && Number(response.amount ?? 0) > 0) return TaxType.MIXED;

    if (Number(response.freetaxsalesamount ?? 0) > 0) return TaxType.TAX_FREE;

    if (Number(response.zerotaxsalesamount ?? 0) > 0) return TaxType.ZERO_TAX;

    return TaxType.TAXED;
  }

  private buildInvoiceFromDetail(
    orderId: string,
    response: UniversalQueryInvoiceDetailResponse,
    fallback?: UniversalQueryInvoiceResponse,
  ): UniversalInvoice {
    const taxType = this.getTaxTypeFromDetail(response);
    const items =
      response.details?.map(item => ({
        name: item.productName ?? '',
        quantity: Number(item.qty ?? 0),
        unitPrice: Number(item.unitPrice ?? 0),
      })) ?? [];

    const state = this.getInvoiceState(fallback?.status ?? response.sellerInvStatus);
    const issuedOn = this.getIssuedOn(response.invDate || fallback?.invDate || '', fallback?.invTime);

    return new UniversalInvoice({
      orderId,
      sellerID: response.sellerCompid ?? this.sellerID,
      buyerID: response.buyerCompid ?? UNIVERSAL_B2C_BUYER_ID,
      buyerName: response.buyerName,
      items,
      issuedOn,
      invoiceNumber: response.invNo || fallback?.invNo || '',
      randomCode: response.randomnumber ?? fallback?.randomNumber ?? '',
      taxType,
      state,
      voidOn: state === InvoiceState.VOID ? issuedOn : null,
    });
  }

  async isMobileBarcodeValid(code: string): Promise<boolean> {
    if (this.skipMobileBarcodeValidation) return true;

    return /^\/[0-9A-Z+\-.]{7}$/.test(code);
  }

  async isLoveCodeValid(code: string): Promise<boolean> {
    if (this.skipLoveCodeValidation) return true;

    return /^\d{3,7}$/.test(code);
  }

  async issue(options: UniversalInvoiceIssueOptions): Promise<UniversalInvoice> {
    if (!options.orderId || options.orderId.length > 50) {
      throw new Error('Order ID is required and max length is 50');
    }

    if (options.vatNumber && !isValidVATNumber(options.vatNumber)) {
      throw new Error('VAT number is invalid');
    }

    if (options.buyerAddress && options.buyerAddress.length > 100) {
      throw new Error('Buyer address is too long, max: 100');
    }

    if (options.remark && options.remark.length > 200) {
      throw new Error('Remark is too long, max: 200');
    }

    if (options.buyerEmail && !isEmail(options.buyerEmail)) {
      throw new Error('Buyer email is invalid');
    }

    if (
      options.carrier?.type === InvoiceCarrierType.MOBILE &&
      !(await this.isMobileBarcodeValid(options.carrier.code))
    ) {
      throw new Error('Mobile barcode is invalid');
    }

    if (options.carrier?.type === InvoiceCarrierType.LOVE_CODE && !(await this.isLoveCodeValid(options.carrier.code))) {
      throw new Error('Love code is invalid');
    }

    if (options.carrier?.type === InvoiceCarrierType.MOICA && !/^[A-Z]{2}[0-9]{14}$/.test(options.carrier.code)) {
      throw new Error('MOICA code is invalid');
    }

    const taxType = getTaxTypeFromItems(options.items);

    if (taxType === TaxType.ZERO_TAX && !options.zeroTaxRateReason) {
      throw new Error('Zero tax rate reason is required for zero tax invoices');
    }

    const isB2B = !!options.vatNumber;
    const buyerID = this.getBuyerID(options.vatNumber);
    const amountSummary = this.getAmountSummary(options.items, taxType);

    if (amountSummary.totalAmount <= 0) {
      throw new Error('Invoice amount should more than zero');
    }

    const carrierFields = this.getCarrierFields(options.carrier);
    const payload: UniversalOpenInvoicePayload = {
      orderID: options.orderId,
      process_type: this.getProcessType(options.vatNumber),
      sellerID: this.sellerID,
      buyerID,
      buyerName: this.getBuyerName(options),
      buyerAddress: options.buyerAddress,
      mainRemark: options.remark,
      invoiceType: options.invoiceType ?? UNIVERSAL_DEFAULT_INVOICE_TYPE,
      ...carrierFields,
      salesAmount: amountSummary.salesAmount,
      freetaxSalesamount: amountSummary.freetaxSalesamount,
      zerotaxSalesamount: amountSummary.zerotaxSalesamount,
      taxType: UniversalTaxTypeCode[taxType] as UniversalTaxTypeCodeValue,
      taxrate: this.getTaxRate(taxType),
      taxAmount: amountSummary.taxAmount,
      totalAmount: amountSummary.totalAmount,
      notifyEmail: options.buyerEmail,
      customsClearanceMark:
        taxType === TaxType.ZERO_TAX ? (options.customsMark === CustomsMark.YES ? '2' : '1') : undefined,
      unitCode: options.unitCode ?? this.unitCode,
      zeroTaxRateReason: options.zeroTaxRateReason,
      Details: this.getIssueDetails(options.items, taxType, isB2B),
    };

    const response = await this.post<UniversalOpenInvoicePayload, UniversalOpenInvoiceResponse>(
      '/openInvoice',
      payload,
    );

    return new UniversalInvoice({
      orderId: options.orderId,
      sellerID: this.sellerID,
      buyerID,
      buyerName: payload.buyerName,
      items: options.items,
      issuedOn: this.getIssuedOn(response.invDate, response.invTime),
      invoiceNumber: response.invNo,
      randomCode: response.randomNumber,
      taxType,
    });
  }

  async void(invoice: UniversalInvoice, options: UniversalInvoiceVoidOptions): Promise<UniversalInvoice> {
    if (invoice.state !== InvoiceState.ISSUED && invoice.state !== InvoiceState.ALLOWANCED) {
      throw new Error('Invoice is not issued');
    }

    const payload: UniversalCancelInvoicePayload = {
      orderID: options.orderId ?? invoice.orderId,
      process_type: invoice.buyerID === UNIVERSAL_B2C_BUYER_ID ? 'C' : 'B',
      sellerID: invoice.sellerID,
      buyerID: invoice.buyerID,
      invNo: invoice.invoiceNumber,
      invDate: this.getInvoiceDate(invoice),
      cancelReason: options.reason.slice(0, 20),
      remark: options.remark,
    };

    const response = await this.post<UniversalCancelInvoicePayload, UniversalCancelInvoiceResponse>(
      '/cancelInvoice',
      payload,
    );

    invoice.setVoid(this.getIssuedOn(response.cancelDate, response.cancelTime));

    return invoice;
  }

  async allowance(
    invoice: UniversalInvoice,
    allowanceItems: UniversalPaymentItem[],
    options?: UniversalInvoiceAllowanceOptions,
  ): Promise<UniversalInvoice> {
    if (invoice.state !== InvoiceState.ISSUED && invoice.state !== InvoiceState.ALLOWANCED) {
      throw new Error('Invoice is not issued');
    }

    const taxType = options?.taxType ? (options.taxType as TaxType) : invoice.taxType;
    const amountSummary = this.getAmountSummary(allowanceItems, taxType);

    if (amountSummary.totalAmount <= 0) {
      throw new Error('Allowance amount should more than zero');
    }

    if (amountSummary.totalAmount > invoice.nowAmount) {
      throw new Error('No enough amount for allowance');
    }

    const salesReturnID = options?.salesReturnID ?? `${invoice.orderId}-A${invoice.allowances.length + 1}`;
    const payload: UniversalOpenAllowancePayload = {
      salesReturnID,
      process_type: invoice.buyerID === UNIVERSAL_B2C_BUYER_ID ? 'C' : 'B',
      sellerID: invoice.sellerID,
      buyerID: invoice.buyerID,
      buyerName: options?.buyerName ?? invoice.buyerName,
      buyerAddress: options?.buyerAddress,
      allowanceType: options?.allowanceType ?? '2',
      taxAmount: amountSummary.taxAmount,
      totalAmount: amountSummary.salesAmount + amountSummary.freetaxSalesamount + amountSummary.zerotaxSalesamount,
      notifyEmail: options?.notifyEmail,
      unitCode: options?.unitCode ?? this.unitCode,
      salesReturnDetail: allowanceItems.map((item, index): UniversalAllowanceDetailPayload => {
        const itemTaxType = item.taxType ?? (taxType === TaxType.MIXED ? TaxType.TAXED : taxType);
        const amount = this.getUntaxedAmount(item, taxType);

        return {
          originalinvDate: this.getInvoiceDate(invoice),
          originalInvoiceNumber: invoice.invoiceNumber,
          originalDescription: item.name,
          quantity: item.quantity,
          unitprice:
            [TaxType.TAXED, TaxType.SPECIAL].includes(itemTaxType) && item.quantity !== 0
              ? Number((amount / item.quantity).toFixed(6))
              : item.unitPrice,
          amount,
          tax: this.getItemAmount(item) - amount,
          sequenceNumber: String(index + 1).padStart(4, '0'),
          taxType: this.getDetailTaxType(item, taxType),
        };
      }),
    };

    const response = await this.post<UniversalOpenAllowancePayload, UniversalOpenAllowanceResponse>(
      '/openAllowance',
      payload,
    );

    const allowance = new UniversalAllowance({
      allowanceNumber: response.allowanceNumber,
      allowanceDate: response.allowanceDate,
      allowancePrice: amountSummary.totalAmount,
      allowancedOn: DateTime.fromFormat(response.allowanceDate, 'yyyyLLdd', { zone: 'Asia/Taipei' }).toJSDate(),
      remainingAmount: invoice.nowAmount - amountSummary.totalAmount,
      items: allowanceItems,
      parentInvoice: invoice,
      status: InvoiceAllowanceState.ISSUED,
      invalidOn: null,
      salesReturnID,
    });

    invoice.addAllowance(allowance);

    return invoice;
  }

  async invalidAllowance(
    allowance: UniversalAllowance,
    options?: UniversalInvoiceInvalidAllowanceOptions,
  ): Promise<UniversalInvoice> {
    if (allowance.status !== InvoiceAllowanceState.ISSUED) {
      throw new Error('Allowance is not issued');
    }

    const invoice = allowance.parentInvoice;
    const payload: UniversalCancelAllowancePayload = {
      salesReturnID: options?.salesReturnID ?? allowance.salesReturnID,
      process_type: invoice.buyerID === UNIVERSAL_B2C_BUYER_ID ? 'C' : 'B',
      sellerID: invoice.sellerID,
      buyerID: invoice.buyerID,
      allowanceNumber: allowance.allowanceNumber,
      allowanceDate: allowance.allowanceDate,
      cancelReason: (options?.reason ?? '折讓作廢').slice(0, 20),
    };

    const response = await this.post<UniversalCancelAllowancePayload, UniversalCancelAllowanceResponse>(
      '/cancelAllowance',
      payload,
    );

    allowance.invalid(this.getIssuedOn(response.cancelDate, response.cancelTime));

    return invoice;
  }

  async query(options: UniversalInvoiceQueryOptions): Promise<UniversalInvoice> {
    if ('orderId' in options) {
      const queryPayload: UniversalQueryInvoicePayload = {
        orderID: options.orderId,
        process_type: options.processType ?? 'C',
        sellerID: this.sellerID,
      };

      const response = await this.post<UniversalQueryInvoicePayload, UniversalQueryInvoiceResponse>(
        '/queryInvoice',
        queryPayload,
      );

      const detailPayload: UniversalQueryInvoiceDetailPayload = {
        invNo: response.invNo,
        invDate: response.invDate,
        process_type: options.processType ?? 'C',
        sellerID: this.sellerID,
      };

      const detail = await this.post<UniversalQueryInvoiceDetailPayload, UniversalQueryInvoiceDetailResponse>(
        '/queryInvoiceDetail',
        detailPayload,
      );

      return this.buildInvoiceFromDetail(options.orderId, detail, response);
    }

    const issuedOn =
      options.issuedOn instanceof Date
        ? DateTime.fromJSDate(options.issuedOn).setZone('Asia/Taipei').toFormat('yyyyLLdd')
        : options.issuedOn;

    const detailPayload: UniversalQueryInvoiceDetailPayload = {
      invNo: options.invoiceNumber,
      invDate: issuedOn,
      process_type: options.processType ?? 'C',
      sellerID: this.sellerID,
    };

    const detail = await this.post<UniversalQueryInvoiceDetailPayload, UniversalQueryInvoiceDetailResponse>(
      '/queryInvoiceDetail',
      detailPayload,
    );

    return this.buildInvoiceFromDetail(options.invoiceNumber, detail);
  }
}
