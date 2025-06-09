import {
  InvoiceAllowanceState,
  InvoiceCarrierType,
  InvoiceGateway,
  InvoiceState,
  TaxType,
  verifyVatNumber
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
  ReverseAmegoTaxType
} from './typings';

export class AmegoInvoiceGateway
  implements InvoiceGateway<AmegoPaymentItem, AmegoInvoice> {
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

    const totalAllowanceAmount = allowanceItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    if (totalAllowanceAmount <= 0) {
      throw new Error('Allowance amount should more than zero');
    }

    const thisAllowanceSeq = invoice.allowances.length + 1;
    const thisAllowanceNumber = `${invoice.invoiceNumber}AL${String(thisAllowanceSeq).padStart(4, '0')}`; // 使用`{訂單編號}:AL:{項次index}`作為 AllowanceNumber

    const now = DateTime.now();

    const totalTaxAmount = allowanceItems.reduce((acc, item) => {
      const itemTax = item.taxType === TaxType.TAXED
        ? (Math.round(item.quantity * item.unitPrice / (1 + invoice.taxRate) * invoice.taxRate) > 1 ?
          Math.round(item.quantity * item.unitPrice / (1 + invoice.taxRate) * invoice.taxRate) : 1)
        : 0

      return acc + itemTax;
    }, 0)

    const dutyFreeTotalAmount = totalAllowanceAmount - totalTaxAmount;

    const payload = [{
      AllowanceNumber: thisAllowanceNumber,
      AllowanceDate: now.toFormat('yyyyMMdd'), // 使用當前日期作為 AllowanceDate
      AllowanceType: options?.allowanceType ? options.allowanceType : 2, // 預設為 2 (賣方開立折讓單)
      BuyerIdentifier: invoice.vatNumber,
      BuyerName: invoice.vatNumber !== '0000000000' ? invoice.vatNumber : '消費者',
      ProductItem: allowanceItems.map((item) => {
        // 折讓單價預設為未稅
        const dutyFreeUnitPrice = Number((item.unitPrice / (1 + invoice.taxRate)).toFixed(7));

        const itemTax = (Math.round(item.quantity * dutyFreeUnitPrice * invoice.taxRate) > 1 ?
          Math.round(item.quantity * dutyFreeUnitPrice * invoice.taxRate) : 1)

        const dutyFreeAmount = Math.round((item.quantity * dutyFreeUnitPrice));

        return {
          OriginalInvoiceNumber: invoice.invoiceNumber, // 原發票號碼
          OriginalInvoiceDate: DateTime.fromJSDate(invoice.issuedOn).toFormat('yyyyMMdd'), // 原發票日期
          OriginalDescription: item.name,
          Quantity: item.quantity, // 折讓數量
          UnitPrice: dutyFreeUnitPrice, // 折讓單價, 未稅
          Amount: dutyFreeAmount, // 折讓金額, 未稅
          Tax: itemTax,
          TaxType: Number(AmegoTaxType[item.taxType]) || Number(AmegoTaxType[TaxType.TAXED]), // 預設為課稅
        }
      }),
      TaxAmount: totalTaxAmount, // 折讓稅額, 預設為課稅
      TotalAmount: dutyFreeTotalAmount,
    }];

    const encodedPayload = this.generateEncodedPayload(JSON.stringify(payload));

    const { data } = await axios.post<{ code: number, msg: string }>(
      `${this.baseUrl}/json/g0401`,
      encodedPayload,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (data.code !== 0) {
      throw new Error('Failed to allowance invoice');
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
  async query(
    options: AmegoInvoiceQueryFromInvoiceNumberArgs,
  ): Promise<AmegoInvoice>;
  async query(options: AmegoInvoiceQueryArgs): Promise<AmegoInvoice> {
    const apiData = 'orderId' in options
      ? {
        type: 'order',
        order_id: options.orderId,
      }
      : {
        type: 'invoice',
        invoice_number: options.invoiceNumber,
      };

    const encodedPayload = this.generateEncodedPayload(JSON.stringify(apiData));

    const { data: resp } = await axios.post<{
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
      };
    }>(`${this.baseUrl}/json/invoice_query`, encodedPayload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (resp.code !== 0) {
      throw new Error(`Amego invoice query failed: ${resp.msg}`);
    }

    const thisInvoiceItems = resp.data.product_item.map((item) => {
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

    const thisInvoice = new AmegoInvoice({
      orderId: resp.data.order_id,
      vatNumber: resp.data.buyer_identifier,
      issuedOn: DateTime.fromFormat(
        `${resp.data.invoice_date}${resp.data.invoice_time}`,
        'yyyyMMddHH:mm:ss',
      ).toJSDate(),
      items: thisInvoiceItems,
      invoiceNumber: resp.data.invoice_number || '',
      randomCode: resp.data.random_number || '',
      carrier: resp.data.carrier_type !== '' ? {
        type: resp.data.carrier_type === '3J0002' ? InvoiceCarrierType.MOBILE : InvoiceCarrierType.MOICA,
        code: resp.data.carrier_id1 || resp.data.carrier_id2 || '',
      } : undefined,
      taxType: ReverseAmegoTaxType[resp.data.tax_type],
      taxRate: parseFloat(resp.data.tax_rate),
      voidOn: null,
      state: InvoiceState.ISSUED,
    });

    const thisInvoiceAllowances = resp.data.allowance.map((allowance, index) => {
      const copyInvoice = new AmegoInvoice({ ...thisInvoice });
      const allowances = resp.data.allowance.reduce((acc, allowance, currentIndex) => {

        // copy thisInvoice to avoid mutation
        const copyInvoice = new AmegoInvoice({ ...thisInvoice });

        if (currentIndex <= index) {
          const thisAllowance = new AmegoAllowance({
            allowanceNumber: allowance.allowance_number,
            invoiceType: allowance.invoice_type,
            allowancedOn: DateTime.fromFormat(
              String(allowance.allowance_date),
              'yyyyMMdd',
            ).toJSDate(),
            allowancePrice: allowance.total_amount + allowance.tax_amount,
            items: [], // Amego does not provide items in allowance query, so we set it to empty array
            status: allowance.invoice_status === 99
              ? InvoiceAllowanceState.ISSUED
              : allowance.invoice_status === 91 ? InvoiceAllowanceState.INVALID : InvoiceAllowanceState.INITED,
            invalidOn: null,
            parentInvoice: copyInvoice,
          })

          acc.push(thisAllowance);

          return acc;
        }

        return acc;
      }, [] as AmegoAllowance[]);

      copyInvoice.accumulatedAllowances.push(...allowances);

      return new AmegoAllowance({
        allowanceNumber: allowance.allowance_number,
        invoiceType: allowance.invoice_type,
        allowancedOn: DateTime.fromFormat(
          String(allowance.allowance_date),
          'yyyyMMdd',
        ).toJSDate(),
        allowancePrice: allowance.total_amount + allowance.tax_amount,
        items: [], // Amego does not provide items in allowance query, so we set it to empty array
        status: allowance.invoice_status === 99
          ? InvoiceAllowanceState.ISSUED
          : allowance.invoice_status === 91 ? InvoiceAllowanceState.INVALID : InvoiceAllowanceState.INITED,
        invalidOn: null,
        parentInvoice: copyInvoice,
      });
    });

    return new AmegoInvoice({
      orderId: resp.data.order_id,
      vatNumber: resp.data.buyer_identifier,
      issuedOn: DateTime.fromFormat(
        `${resp.data.invoice_date}${resp.data.invoice_time}`,
        'yyyyMMddHH:mm:ss',
      ).toJSDate(),
      invoiceNumber: resp.data.invoice_number || '',
      randomCode: resp.data.random_number || '',
      carrier: resp.data.carrier_type !== '' ? {
        type: resp.data.carrier_type === '3J0002' ? InvoiceCarrierType.MOBILE : InvoiceCarrierType.MOICA,
        code: resp.data.carrier_id1 || resp.data.carrier_id2 || '',
      } : undefined,
      taxType: ReverseAmegoTaxType[resp.data.tax_type],
      taxRate: parseFloat(resp.data.tax_rate),
      voidOn: null,
      state: InvoiceState.ISSUED,
      allowances: thisInvoiceAllowances,
      items: thisInvoiceItems,
    });
  }

  async invalidAllowance(
    allowance: AmegoAllowance,
  ): Promise<AmegoInvoice> {
    if (allowance.parentInvoice.state !== InvoiceState.VOID) {
      throw new Error('Invoice is not voided');
    }

    const encodedData = this.generateEncodedPayload(JSON.stringify([{ CancelAllowanceNumber: allowance.allowanceNumber }]));

    const { data } = await axios.post<{ code: number; msg: string }>(
      `${this.baseUrl}/json/g0501`,
      encodedData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (data.code !== 0) {
      throw new Error(`Amego invoice cancel void failed: ${data.msg}`);
    }

    allowance.invalid();

    return allowance.parentInvoice;
  }

  async issue(options: AmegoInvoiceIssueOptions): Promise<AmegoInvoice> {
    if (!options.orderId) {
      throw new Error('Order ID is required');
    }

    if (options.vatNumber && !verifyVatNumber(options.vatNumber)) {
      throw new Error('Invalid VAT number format');
    }

    if (!options.detailVat && !options.vatNumber) {
      throw new Error(
        'Buyer identifier is required when detail VAT is false (未稅)',
      );
    }

    if (options.orderId.length > 40) {
      throw new Error('Order ID must be less than or equal to 40 characters');
    }

    if (!options.items || options.items.length === 0) {
      throw new Error('At least one product item is required');
    }

    if (
      options.items.some(
        (item) => !item.name || (item.name && item.name.length > 256),
      )
    ) {
      throw new Error(
        'Item description must be less than or equal to 256 characters',
      );
    }

    if (options.items.some((item) => item.unit && item.unit.length > 6)) {
      throw new Error('Item unit must be less than or equal to 6 characters');
    }

    if (options.items.some((item) => item.remark && item.remark.length > 40)) {
      throw new Error(
        'Item remark must be less than or equal to 40 characters',
      );
    }

    let salesAmount = options.items
      .filter((item) => item.taxType === TaxType.TAXED)
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const salesAmountZeroTax = options.items
      .filter((item) => item.taxType === TaxType.ZERO_TAX)
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const salesAmountTaxFree = options.items
      .filter((item) => item.taxType === TaxType.TAX_FREE)
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const taxType = AmegoTaxType[options.taxType];

    const taxRate = options.taxRate ?? 0.05; // 預設稅率 5%

    const taxAmount = options.detailVat
      ? options.vatNumber
        ? salesAmount - Math.round(salesAmount / (1 + taxRate))
        : 0
      : Math.round(salesAmount * taxRate);

    salesAmount = salesAmount - taxAmount;

    const totalAmount =
      salesAmount + salesAmountZeroTax + salesAmountTaxFree + taxAmount;

    const carrierId = ((): string | undefined => {
      switch (options.carrier?.type) {
        case InvoiceCarrierType.MOBILE:
        case InvoiceCarrierType.MOICA:
          return options.carrier.code;

        default:
          return '';
      }
    })();

    const payload = {
      OrderId: options.orderId,
      BuyerIdentifier: options.vatNumber
        ? options.vatNumber
        : '0000000000', // 預設為空統一編號
      BuyerName: options.vatNumber ? options.vatNumber : '消費者',
      BuyerEmail: options.buyerEmail || '',
      CarrierType: ((): '3J0002' | 'CQ0001' | '' => {
        switch (options.carrier?.type) {
          case InvoiceCarrierType.MOBILE:
            return '3J0002';
          case InvoiceCarrierType.MOICA:
            return 'CQ0001';
          default:
            return '';
        }
      })(),
      CarrierId1: carrierId ?? '',
      CarrierId2: carrierId ?? '',
      ProductItem: options.items.map((item) => {
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
      DetailVat: options.detailVat ? 1 : 0, // 明細是否含稅, 1:含稅(預設), 0:未稅
      DetailAmountRound: 0, // 明細小記 1: 四捨五入到整數, 0: 直接加總(預設)
    };

    const encodedPayload = this.generateEncodedPayload(JSON.stringify(payload));

    const { data } = await axios.post<AmegoIssueInvoiceResponse>(
      `${this.baseUrl}/json/f0401`,
      encodedPayload,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (data.code !== 0) {
      throw new Error(`Amego invoice issue failed: ${data.msg}`);
    }

    return new AmegoInvoice({
      orderId: options.orderId,
      vatNumber: options.vatNumber,
      items: options.items,
      issuedOn: data.invoice_time ? new Date(data.invoice_time) : null,
      invoiceNumber: data.invoice_number,
      randomCode: data.random_number,
      taxType: options.taxType,
      voidOn: null,
      state: InvoiceState.ISSUED,
      allowances: [],
      taxRate: taxRate,
    });
  }

  async void(invoice: AmegoInvoice): Promise<AmegoInvoice> {

    const encodedData = this.generateEncodedPayload(JSON.stringify([{ CancelInvoiceNumber: invoice.invoiceNumber }]));

    const { data } = await axios.post<{ code: number; msg: string }>(
      `${this.baseUrl}/json/f0501`,
      encodedData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (data.code !== 0) {
      throw new Error(`Amego invoice void failed: ${data.msg}`);
    }

    invoice.setVoid();

    return invoice;
  }

  async isMobileBarcodeValid(code: string): Promise<boolean> {

    const encodedPayload = this.generateEncodedPayload(JSON.stringify({ barCode: code }));

    const { data } = await axios.post<{ code: number; msg: string }>(
      `${this.baseUrl}/json/barcode`,
      encodedPayload,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return data.code === 0;
  }

  async isLoveCodeValid(code: string): Promise<boolean> {
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
    }

    return `invoice=${payload.invoice}&data=${encodeURIComponent(payload.data)}&time=${payload.time}&sign=${payload.sign}`;
  }
}
