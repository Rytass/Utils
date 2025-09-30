import {
  InvoiceAllowanceState,
  InvoiceCarrierType,
  InvoiceGateway,
  InvoiceState,
  TaxType,
  verifyVatNumber,
} from '@rytass/invoice';
import axios from 'axios';
import { createHash } from 'crypto';
import { DateTime } from 'luxon';

import { AmegoAllowance } from './amego-allowance';
import { AmegoInvoice } from './amego-invoice';
import {
  AmegoAllowanceOptions,
  AmegoBaseUrls,
  AmegoInvoiceGatewayOptions,
  AmegoInvoiceIssueOptions,
  AmegoInvoiceQueryArgs,
  AmegoInvoiceQueryFromInvoiceNumberArgs,
  AmegoInvoiceQueryFromOrderIdArgs,
  AmegoIssueInvoiceResponse,
  AmegoPaymentItem,
  AmegoTaxType,
  ReverseAmegoTaxType,
  AMEGO_CONSTANTS,
} from './typings';

export class AmegoInvoiceGateway implements InvoiceGateway<AmegoPaymentItem, AmegoInvoice> {
  private static readonly DEFAULT_ALLOWANCE_TYPE = 2;
  private static readonly COMMON_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded',
  } as const;

  private readonly baseUrl: string = AmegoBaseUrls.DEVELOPMENT;
  private readonly vatNumber: string = '12345678';
  private readonly appKey: string = 'sHeq7t8G1wiQvhAuIM27';

  constructor(options?: AmegoInvoiceGatewayOptions) {
    this.baseUrl = options?.baseUrl || this.baseUrl;
    this.vatNumber = options?.vatNumber ?? this.vatNumber;
    this.appKey = options?.appKey ?? this.appKey;
  }

  async allowance(
    invoice: AmegoInvoice,
    allowanceItems: AmegoPaymentItem[],
    options?: AmegoAllowanceOptions,
  ): Promise<AmegoInvoice> {
    if (invoice.state !== InvoiceState.ISSUED) {
      throw new Error('Invoice is not issued');
    }

    this.validateAllowanceItems(allowanceItems);

    const totalAllowanceAmount = allowanceItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const thisAllowanceSeq = invoice.allowances.length + 1;
    const thisAllowanceNumber = `${invoice.invoiceNumber}AL${String(thisAllowanceSeq).padStart(4, '0')}`; // 使用`{訂單編號}:AL:{項次index}`作為 AllowanceNumber

    const now = DateTime.now();

    const totalTaxAmount = allowanceItems.reduce((acc, item) => {
      const itemTax =
        item.taxType === TaxType.TAXED
          ? Math.round(((item.quantity * item.unitPrice) / (1 + invoice.taxRate)) * invoice.taxRate) > 1
            ? Math.round(((item.quantity * item.unitPrice) / (1 + invoice.taxRate)) * invoice.taxRate)
            : 1
          : 0;

      return acc + itemTax;
    }, 0);

    const dutyFreeTotalAmount = totalAllowanceAmount - totalTaxAmount;

    const payload = [
      {
        AllowanceNumber: thisAllowanceNumber,
        AllowanceDate: now.toFormat('yyyyMMdd'), // 使用當前日期作為 AllowanceDate
        AllowanceType: options?.allowanceType || AmegoInvoiceGateway.DEFAULT_ALLOWANCE_TYPE, // 預設為 2 (賣方開立折讓單)
        BuyerIdentifier: invoice.vatNumber,
        BuyerName: invoice.vatNumber !== '0000000000' ? invoice.vatNumber : '消費者',
        ProductItem: allowanceItems.map(item => {
          // 折讓單價預設為未稅
          const dutyFreeUnitPrice = Number((item.unitPrice / (1 + invoice.taxRate)).toFixed(7));

          const itemTax =
            Math.round(item.quantity * dutyFreeUnitPrice * invoice.taxRate) > 1
              ? Math.round(item.quantity * dutyFreeUnitPrice * invoice.taxRate)
              : 1;

          const dutyFreeAmount = Math.round(item.quantity * dutyFreeUnitPrice);

          return {
            OriginalInvoiceNumber: invoice.invoiceNumber, // 原發票號碼
            OriginalInvoiceDate: DateTime.fromJSDate(invoice.issuedOn).toFormat('yyyyMMdd'), // 原發票日期
            OriginalDescription: item.name,
            Quantity: item.quantity, // 折讓數量
            UnitPrice: dutyFreeUnitPrice, // 折讓單價, 未稅
            Amount: dutyFreeAmount, // 折讓金額, 未稅
            Tax: itemTax,
            TaxType: Number(AmegoTaxType[item.taxType]) || Number(AmegoTaxType[TaxType.TAXED]), // 預設為課稅
          };
        }),
        TaxAmount: totalTaxAmount, // 折讓稅額, 預設為課稅
        TotalAmount: dutyFreeTotalAmount,
      },
    ];

    const encodedPayload = this.generateEncodedPayload(JSON.stringify(payload));

    const data = await this.makeApiRequest<{ code: number; msg: string }>('/json/g0401', encodedPayload);

    if (data.code !== 0) {
      throw new Error(`Failed to allowance invoice: ${data.msg}`);
    }

    invoice.allowances.push(
      new AmegoAllowance({
        allowanceNumber: thisAllowanceNumber,
        allowancedOn: now.toJSDate(),
        allowancePrice: totalAllowanceAmount,
        items: allowanceItems,
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice: invoice,
      }),
    );

    return invoice;
  }

  async query(options: AmegoInvoiceQueryFromOrderIdArgs): Promise<AmegoInvoice>;
  async query(options: AmegoInvoiceQueryFromInvoiceNumberArgs): Promise<AmegoInvoice>;
  async query(options: AmegoInvoiceQueryArgs): Promise<AmegoInvoice> {
    const apiData =
      'orderId' in options
        ? {
            type: 'order',
            order_id: options.orderId,
          }
        : {
            type: 'invoice',
            invoice_number: options.invoiceNumber,
          };

    const encodedPayload = this.generateEncodedPayload(JSON.stringify(apiData));

    const { data } = await axios.post<{
      code: number;
      msg: string;
      data: {
        order_id: string;
        invoice_number: string;
        random_number: string;
        invoice_type: string;
        invoice_date: string;
        invoice_time: string;
        buyer_identifier: string;
        carrier_type: string;
        carrier_id1: string;
        carrier_id2: string;
        buyer_name: string;
        buyer_email_address: string;
        npoban: string;
        tax_rate: string;
        tax_type: number;
        allowance: {
          invoice_type: string;
          invoice_status: number;
          allowance_type: string;
          allowance_number: string;
          allowance_date: string;
          tax_amount: number;
          total_amount: number;
        }[];
        product_item: {
          tax_type: number; // AmegoTaxType
          description: string;
          unit_price: number;
          quantity: number;
          unit?: string;
          amount: number;
          remark?: string;
        }[];
        cancel_date: number;
      };
    }>(`${this.baseUrl}/json/invoice_query`, encodedPayload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (data.code !== 0) {
      throw new Error(`Amego invoice query failed: ${data.msg}`);
    }

    const thisInvoiceItems = data.data.product_item.map(item => {
      return {
        taxType: ReverseAmegoTaxType[item.tax_type] as TaxType.TAXED | TaxType.ZERO_TAX | TaxType.TAX_FREE,
        name: item.description,
        unitPrice: item.unit_price,
        quantity: item.quantity,
        amount: item.amount,
        unit: item.unit || '',
        remark: item.remark || '',
      };
    });

    const voidOn = data.data.cancel_date ? DateTime.fromSeconds(data.data.cancel_date).toJSDate() : null;

    const state = this.getInvoiceState(data.data.invoice_type);

    const thisInvoice = new AmegoInvoice({
      orderId: data.data.order_id,
      vatNumber: data.data.buyer_identifier,
      issuedOn: DateTime.fromFormat(
        `${data.data.invoice_date}${data.data.invoice_time}`,
        'yyyyMMddHH:mm:ss',
      ).toJSDate(),
      items: thisInvoiceItems,
      invoiceNumber: data.data.invoice_number || '',
      randomCode: data.data.random_number || '',
      carrier: this.parseCarrierFromResponse(
        data.data.carrier_type,
        data.data.carrier_id1,
        data.data.carrier_id2,
        data.data.npoban,
      ),
      taxType: ReverseAmegoTaxType[data.data.tax_type],
      taxRate: parseFloat(data.data.tax_rate),
      voidOn: voidOn,
      state: state,
      buyerInfo: {
        name: data.data.buyer_name || '',
        email: data.data.buyer_email_address || '',
      },
    });

    const thisInvoiceAllowances = data.data.allowance.map((allowanceData, index) => {
      // 創建一個該 allowance 專用的 invoice 副本
      const parentInvoice = new AmegoInvoice({ ...thisInvoice });

      // 創建當前 allowance 之前的所有 allowances（累積狀態）
      const previousAllowances = data.data.allowance
        .slice(0, index) // 只取當前 allowance 之前的
        .map(prevAllowanceData => {
          // 判斷是否為無效狀態
          const isInvalid =
            this.getInvoiceAllowanceState(prevAllowanceData.invoice_type) === InvoiceAllowanceState.INVALID;

          const prevAllowance = new AmegoAllowance({
            allowanceNumber: prevAllowanceData.allowance_number,
            invoiceType: prevAllowanceData.invoice_type,
            allowancedOn: DateTime.fromFormat(String(prevAllowanceData.allowance_date), 'yyyyMMdd').toJSDate(),
            allowancePrice: prevAllowanceData.total_amount + prevAllowanceData.tax_amount,
            items: [], // Amego does not provide items in allowance query, so we set it to empty array
            status: this.getInvoiceAllowanceState(prevAllowanceData.invoice_type),
            invalidOn: isInvalid
              ? DateTime.fromFormat(String(prevAllowanceData.allowance_date), 'yyyyMMdd').toJSDate()
              : null,
            parentInvoice: parentInvoice,
          });

          // 如果是無效類型但狀態還未更新，手動標記為無效
          if (isInvalid) {
            prevAllowance.invalid();
          }

          return prevAllowance;
        });

      // 將之前的 allowances 加入到 parent invoice 中
      parentInvoice.accumulatedAllowances.push(...previousAllowances);

      // 判斷當前 allowance 是否為無效狀態
      const isCurrentInvalid =
        this.getInvoiceAllowanceState(allowanceData.invoice_type) === InvoiceAllowanceState.INVALID;

      // 創建當前的 allowance
      const currentAllowance = new AmegoAllowance({
        allowanceNumber: allowanceData.allowance_number,
        invoiceType: allowanceData.invoice_type,
        allowancedOn: DateTime.fromFormat(String(allowanceData.allowance_date), 'yyyyMMdd').toJSDate(),
        allowancePrice: allowanceData.total_amount + allowanceData.tax_amount,
        items: [], // Amego does not provide items in allowance query, so we set it to empty array
        status: this.getInvoiceAllowanceState(allowanceData.invoice_type),
        invalidOn: isCurrentInvalid
          ? DateTime.fromFormat(String(allowanceData.allowance_date), 'yyyyMMdd').toJSDate()
          : null,
        parentInvoice: parentInvoice,
      });

      // 如果是無效類型但狀態還未更新，手動標記為無效
      if (isCurrentInvalid) {
        currentAllowance.invalid();
      }

      return currentAllowance;
    });

    return new AmegoInvoice({
      orderId: data.data.order_id,
      vatNumber: data.data.buyer_identifier,
      issuedOn: DateTime.fromFormat(
        `${data.data.invoice_date}${data.data.invoice_time}`,
        'yyyyMMddHH:mm:ss',
      ).toJSDate(),
      invoiceNumber: data.data.invoice_number || '',
      randomCode: data.data.random_number || '',
      carrier: this.parseCarrierFromResponse(
        data.data.carrier_type,
        data.data.carrier_id1,
        data.data.carrier_id2,
        data.data.npoban,
      ),
      taxType: ReverseAmegoTaxType[data.data.tax_type],
      taxRate: parseFloat(data.data.tax_rate),
      voidOn: voidOn,
      state: state,
      allowances: thisInvoiceAllowances,
      items: thisInvoiceItems,
      buyerInfo: {
        name: data.data.buyer_name || '',
        email: data.data.buyer_email_address || '',
      },
    });
  }

  getInvoiceState(invoiceType: string): InvoiceState {
    switch (invoiceType) {
      case 'A0401': // B2B發票開立
      case 'C0401': // B2C發票開立
      case 'F0401': // 發票開立
      case 'B0501': // B2B折讓作廢
      case 'D0501': // B2C折讓作廢
      case 'G0501': // 折讓單作廢
        return InvoiceState.ISSUED;
      case 'A0501': // B2B發票作廢
      case 'C0501': // B2C發票作廢
      case 'F0501': // 發票作廢
        return InvoiceState.VOID;
      case 'B0401': // B2B折讓開立
      case 'D0401': // B2C折讓開立
      case 'G0401': // 折讓單開立
        return InvoiceState.ALLOWANCED;
      default:
        return InvoiceState.INITED;
    }
  }

  getInvoiceAllowanceState(invoiceType: string): InvoiceAllowanceState {
    switch (invoiceType) {
      case 'B0501': // B2B折讓作廢
      case 'D0501': // B2C折讓作廢
      case 'G0501': // 折讓單作廢
        return InvoiceAllowanceState.INVALID;
      case 'B0401': // B2B折讓開立
      case 'D0401': // B2C折讓開立
      case 'G0401': // 折讓單開立
        return InvoiceAllowanceState.ISSUED;
      default:
        return InvoiceAllowanceState.INITED;
    }
  }

  getCarrierInfo(options: { carrier?: { type?: InvoiceCarrierType; code?: string }; buyerEmail?: string }): {
    carrierId: string;
    carrierType: '3J0002' | 'CQ0001' | 'amego' | '';
    buyerEmail: string;
    loveCode: string;
  } {
    switch (options.carrier?.type) {
      case InvoiceCarrierType.PLATFORM:
        return {
          carrierId: options.buyerEmail ?? '',
          carrierType: 'amego',
          buyerEmail: options.buyerEmail ?? '',
          loveCode: '',
        };
      case InvoiceCarrierType.MOBILE:
        return {
          carrierId: options.carrier?.code ?? '',
          carrierType: '3J0002',
          buyerEmail: options.buyerEmail ?? '',
          loveCode: '',
        };
      case InvoiceCarrierType.MOICA:
        return {
          carrierId: options.carrier?.code ?? '',
          carrierType: 'CQ0001',
          buyerEmail: options.buyerEmail ?? '',
          loveCode: '',
        };
      case InvoiceCarrierType.LOVE_CODE:
        return {
          carrierId: '',
          carrierType: '',
          buyerEmail: options.buyerEmail ?? '',
          loveCode: options.carrier?.code ?? '',
        };
      default:
        return {
          carrierId: '',
          carrierType: '',
          buyerEmail: options.buyerEmail ?? '',
          loveCode: '',
        };
    }
  }

  private parseCarrierFromResponse(
    carrierType: string,
    carrierId1: string,
    carrierId2: string,
    loveCode?: string,
  ): { type: InvoiceCarrierType; code: string } | undefined {
    if (carrierType === undefined) {
      return undefined;
    }

    switch (carrierType) {
      case '3J0002': // 手機條碼
        return {
          type: InvoiceCarrierType.MOBILE,
          code: carrierId1 || carrierId2 || '',
        };
      case 'CQ0001': // 自然人憑證條碼
        return {
          type: InvoiceCarrierType.MOICA,
          code: carrierId1 || carrierId2 || '',
        };
      case 'amego': // 平台載具
        return {
          type: InvoiceCarrierType.PLATFORM,
          code: carrierId1 || carrierId2 || '',
        };
      default: {
        // 如果是其他未知的載具類型，嘗試判斷是否為愛心碼
        const code = carrierId1 || carrierId2 || loveCode || '';

        if (
          code &&
          code.length >= AMEGO_CONSTANTS.LOVE_CODE_MIN_LENGTH &&
          code.length <= AMEGO_CONSTANTS.LOVE_CODE_MAX_LENGTH &&
          /^\d+$/.test(code)
        ) {
          return {
            type: InvoiceCarrierType.LOVE_CODE,
            code: code,
          };
        }

        return undefined;
      }
    }
  }

  async invalidAllowance(allowance: AmegoAllowance): Promise<AmegoInvoice> {
    const encodedData = this.generateEncodedPayload(
      JSON.stringify([{ CancelAllowanceNumber: allowance.allowanceNumber }]),
    );

    const data = await this.makeApiRequest<{ code: number; msg: string }>('/json/g0501', encodedData);

    if (data.code !== 0) {
      throw new Error(`Amego invoice cancel void failed: ${data.msg}`);
    }

    allowance.invalid();

    return this.query({
      invoiceNumber: allowance.parentInvoice.invoiceNumber,
    });
  }

  async issue(options: AmegoInvoiceIssueOptions): Promise<AmegoInvoice> {
    if (!options.orderId) {
      throw new Error('Order ID is required');
    }

    if (options.vatNumber && !verifyVatNumber(options.vatNumber)) {
      throw new Error('Invalid VAT number format');
    }

    if (options.detailVat === false && !options.vatNumber) {
      throw new Error('未稅價發票必須提供統一編號 (DetailVat=0 requires VAT number)');
    }

    if (options.orderId.length > AMEGO_CONSTANTS.MAX_ORDER_ID_LENGTH) {
      throw new Error(`Order ID must be less than or equal to ${AMEGO_CONSTANTS.MAX_ORDER_ID_LENGTH} characters`);
    }

    if (!options.items || options.items.length === 0) {
      throw new Error('At least one product item is required');
    }

    if (
      options.items.some(item => !item.name || (item.name && item.name.length > AMEGO_CONSTANTS.MAX_ITEM_NAME_LENGTH))
    ) {
      throw new Error(
        `Item description must be less than or equal to ${AMEGO_CONSTANTS.MAX_ITEM_NAME_LENGTH} characters`,
      );
    }

    if (options.items.some(item => item.unit && item.unit.length > AMEGO_CONSTANTS.MAX_ITEM_UNIT_LENGTH)) {
      throw new Error(`Item unit must be less than or equal to ${AMEGO_CONSTANTS.MAX_ITEM_UNIT_LENGTH} characters`);
    }

    if (options.items.some(item => item.remark && item.remark.length > AMEGO_CONSTANTS.MAX_ITEM_REMARK_LENGTH)) {
      throw new Error(`Item remark must be less than or equal to ${AMEGO_CONSTANTS.MAX_ITEM_REMARK_LENGTH} characters`);
    }

    if (options.carrier?.type === InvoiceCarrierType.PLATFORM && !options.buyerEmail) {
      throw new Error('Platform carrier should provide buyer email to received notification');
    }

    const salesAmountTaxed = options.items
      .filter(item => item.taxType === TaxType.TAXED)
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const salesAmountZeroTax = options.items
      .filter(item => item.taxType === TaxType.ZERO_TAX)
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const salesAmountTaxFree = options.items
      .filter(item => item.taxType === TaxType.TAX_FREE)
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const taxType = AmegoTaxType[options.taxType];

    const taxRate = options.taxRate ?? AMEGO_CONSTANTS.DEFAULT_TAX_RATE; // 預設稅率 5%

    const taxAmount = options.detailVat
      ? options.vatNumber
        ? salesAmountTaxed - Math.round(salesAmountTaxed / (1 + taxRate))
        : 0
      : Math.round(salesAmountTaxed * taxRate);

    const salesAmount = salesAmountTaxed - taxAmount;

    const totalAmount = salesAmount + salesAmountZeroTax + salesAmountTaxFree + taxAmount;

    const { carrierId, carrierType, buyerEmail, loveCode } = this.getCarrierInfo({
      carrier: options.carrier,
      buyerEmail: options.buyerEmail,
    });

    const payload = {
      OrderId: options.orderId,
      BuyerIdentifier: options.vatNumber ? options.vatNumber : '0000000000', // 預設為空統一編號
      BuyerName: options.vatNumber && options.buyerName ? options.buyerName : (options.vatNumber ?? '消費者'),
      BuyerEmailAddress: buyerEmail,
      CarrierType: carrierType,
      CarrierId1: carrierId ?? '',
      CarrierId2: carrierId ?? '',
      NPOBAN: loveCode,
      ProductItem: options.items.map(item => {
        return {
          Description: item.name,
          Quantity: item.quantity,
          Unit: item.unit || '',
          UnitPrice: item.unitPrice,
          Amount: item.quantity * item.unitPrice,
          Remark: item.remark || '',
          TaxType: AmegoTaxType[item.taxType] || AmegoTaxType[TaxType.TAXED], // 預設為課稅
        };
      }),
      SalesAmount: salesAmount, // 銷售金額
      ZeroTaxSalesAmount: salesAmountZeroTax, // 零稅率銷售金額
      FreeTaxSalesAmount: salesAmountTaxFree, // 免稅銷售金額
      TaxType: taxType,
      TaxRate: taxRate,
      TaxAmount: taxAmount, // 稅額
      TotalAmount: totalAmount, // 總金額
      DetailVat: options.vatNumber && options.detailVat === false ? 0 : 1, // 明細單價類型: 1:含稅價(預設), 0:未稅價(只有打統編才能設定)
      DetailAmountRound: 0, // 明細小計處理: 0:小數精準度到7位數(預設), 1:四捨五入到整數
    };

    const encodedPayload = this.generateEncodedPayload(JSON.stringify(payload));

    const { data } = await axios.post<AmegoIssueInvoiceResponse>(`${this.baseUrl}/json/f0401`, encodedPayload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (data.code !== 0) {
      throw new Error(`Amego invoice issue failed: ${data.msg}`);
    }

    const carrier = this.parseCarrierFromResponse(carrierType, carrierId, carrierId, loveCode);
    const buyerInfo = {
      name: options.buyerName || (options.vatNumber ? options.vatNumber : '消費者'),
      email: buyerEmail,
    };

    return new AmegoInvoice({
      orderId: options.orderId,
      vatNumber: options.vatNumber,
      items: options.items,
      issuedOn: data.invoice_time ? new Date(data.invoice_time * 1000) : null,
      invoiceNumber: data.invoice_number,
      randomCode: data.random_number,
      taxType: options.taxType,
      voidOn: null,
      state: InvoiceState.ISSUED,
      allowances: [],
      taxRate: taxRate,
      carrier,
      buyerInfo,
    });
  }

  async void(invoice: AmegoInvoice): Promise<AmegoInvoice> {
    const encodedData = this.generateEncodedPayload(JSON.stringify([{ CancelInvoiceNumber: invoice.invoiceNumber }]));

    const data = await this.makeApiRequest<{ code: number; msg: string }>('/json/f0501', encodedData);

    if (data.code !== 0) {
      throw new Error(`Amego invoice void failed: ${data.msg}`);
    }

    invoice.setVoid();

    return invoice;
  }

  async isMobileBarcodeValid(code: string): Promise<boolean> {
    const encodedPayload = this.generateEncodedPayload(JSON.stringify({ barCode: code }));

    const data = await this.makeApiRequest<{ code: number; msg: string }>('/json/barcode', encodedPayload);

    return data.code === 0;
  }

  async isLoveCodeValid(_code: string): Promise<boolean> {
    throw new Error('Method not supported in Amego API.');
  }

  private generateEncodedPayload(apiData: string): string {
    const nowMillisecond = Math.floor(DateTime.now().toSeconds());

    const apiSign = `${apiData}${nowMillisecond}${this.appKey}`;

    const hashSign = createHash('md5').update(apiSign, 'utf8').digest('hex');

    const payload = {
      invoice: this.vatNumber,
      data: apiData,
      time: nowMillisecond,
      sign: hashSign,
    };

    return `invoice=${payload.invoice}&data=${encodeURIComponent(payload.data)}&time=${payload.time}&sign=${payload.sign}`;
  }

  private async makeApiRequest<T>(endpoint: string, payload: string): Promise<T> {
    const { data } = await axios.post<T>(`${this.baseUrl}${endpoint}`, payload, {
      headers: AmegoInvoiceGateway.COMMON_HEADERS,
    });

    return data;
  }

  private validateAllowanceItems(items: AmegoPaymentItem[]): void {
    if (!items || items.length === 0) {
      throw new Error('Allowance items cannot be empty');
    }

    items.forEach((item, index) => {
      if (item.quantity <= 0) {
        throw new Error(`Item ${index}: quantity must be positive`);
      }

      if (item.unitPrice <= 0) {
        throw new Error(`Item ${index}: unitPrice must be positive`);
      }
    });
  }
}
