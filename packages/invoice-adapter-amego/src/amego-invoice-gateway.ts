import {
  Invoice,
  InvoiceAllowance,
  InvoiceAllowanceOptions,
  InvoiceGateway,
  InvoicePaymentItem,
  InvoiceState,
  InvoiceVoidOptions,
  PaymentItem,
  TaxType,
} from '@rytass/invoice';
import axios from 'axios';
import { DateTime } from 'luxon';
import { createHash } from 'crypto';

import { AmegoInvoice } from './amego-invoice';
import {
  AmegoBaseUrls,
  AmegoInvoiceGatewayOptions,
  AmegoInvoiceIssueOptions,
  AmegoInvoiceQueryArgs,
  AmegoInvoiceQueryFromInvoiceNumberArgs,
  AmegoInvoiceQueryFromOrderIdArgs,
  AmegoInvoiceVoidOptions,
  AmegoIssueInvoiceResponse,
  AmegoPaymentItem,
  AmegoTaxType,
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

  allowance(
    invoice: Invoice<PaymentItem>,
    allowanceItems: InvoicePaymentItem[],
    options?: InvoiceAllowanceOptions,
  ): Promise<Invoice<PaymentItem>> {
    throw new Error('Method not implemented.');
  }

  invalidAllowance(
    allowance: InvoiceAllowance<PaymentItem>,
  ): Promise<Invoice<PaymentItem>> {
    throw new Error('Method not implemented.');
  }

  async query(options: AmegoInvoiceQueryFromOrderIdArgs): Promise<AmegoInvoice>;
  async query(
    options: AmegoInvoiceQueryFromInvoiceNumberArgs,
  ): Promise<AmegoInvoice>;
  async query(options: AmegoInvoiceQueryArgs): Promise<AmegoInvoice> {
    const apiData = 'orderId' in options
      ? JSON.stringify({
        type: 'order',
        order_id: options.orderId,
      })
      : JSON.stringify({
        type: 'invoice',
        invoice_number: options.invoiceNumber,
      });

    const encodedPayload = this.generateEncodedPayload(apiData);

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
      };
    }>(`${this.baseUrl}/json/invoice_query`, encodedPayload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('Amego invoice query response:', JSON.stringify(resp, null, 2));

    if (resp.code !== 0) {
      throw new Error(`Amego invoice query failed: ${resp.msg}`);
    }

    return new AmegoInvoice({
      orderId: resp.data.order_id,
      buyerId: '',
      buyerName: '',
      items: [],
      issuedOn: DateTime.fromFormat(
        `${resp.data.invoice_date}${resp.data.invoice_time}`,
        'yyyyMMddHH:mm:ss',
      ).toJSDate(),
      invoiceNumber: resp.data.invoice_number || '',
      randomCode: resp.data.random_number || '',
      taxType: TaxType.TAXED,
      voidOn: null,
      state: InvoiceState.ISSUED,
      allowances: [],
    });
  }

  isLoveCodeValid(code: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async issue(options: AmegoInvoiceIssueOptions): Promise<AmegoInvoice> {
    if (!options.orderId) {
      throw new Error('Order ID is required');
    }

    if (!options.buyerIdentifier) {
      throw new Error('Buyer identifier is required');
    }

    if (!options.detailVat && !options.buyerIdentifier) {
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

    const salesAmount = options.items
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
      ? options.buyerIdentifier
        ? salesAmount - Math.round(salesAmount / (1 + taxRate))
        : 0
      : Math.round(salesAmount * taxRate);

    const totalAmount =
      salesAmount + salesAmountZeroTax + salesAmountTaxFree + taxAmount;

    const payload = {
      OrderId: options.orderId,
      BuyerIdentifier: options.buyerIdentifier
        ? options.buyerIdentifier
        : '0000000000', // 預設為空統一編號
      BuyerName: options.buyerIdentifier ? options.buyerIdentifier : '消費者',
      ProductItem: options.items.map((item) => {
        return {
          Description: item.name,
          Quantity: item.quantity,
          Unit: item.unit || '',
          UnitPrice: item.unitPrice,
          Amount: item.amount,
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
      DetailVat: options.detailVat ? 1 : 0, // 明細是否含稅, 1 為含稅, 0 為未稅
      DetailAmountRound: 1, // 四捨五入到整數
    };

    console.log(
      'Amego invoice issue payload:',
      JSON.stringify(payload, null, 2),
    );

    const apiData = JSON.stringify(payload);

    const encodedPayload = this.generateEncodedPayload(apiData);

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
      buyerId: options.buyerIdentifier,
      buyerName: options.buyerIdentifier,
      items: options.items,
      issuedOn: data.invoice_time ? new Date(data.invoice_time) : null,
      invoiceNumber: data.invoice_number,
      randomCode: data.random_number,
      taxType: options.taxType,
      voidOn: null,
      state: InvoiceState.ISSUED,
      allowances: [],
    });
  }

  async isMobileBarcodeValid(code: string): Promise<boolean> {
    const apiData = JSON.stringify({
      barCode: code,
    });

    const encodedPayload = this.generateEncodedPayload(apiData);

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

  async void(invoice: AmegoInvoice): Promise<AmegoInvoice> {
    console.warn(`invoice ${JSON.stringify(invoice)}`);

    const apiData = JSON.stringify([
      {
        CancelInvoiceNumber: invoice.invoiceNumber,
      },
    ]);

    const encodedData = this.generateEncodedPayload(apiData);

    const { data } = await axios.post<{ code: number; msg: string }>(
      `${this.baseUrl}/json/f0501`,
      encodedData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    console.log('Amego invoice void response:', JSON.stringify(data, null, 2));

    if (data.code !== 0) {
      throw new Error(`Amego invoice void failed: ${data.msg}`);
    }

    invoice.setVoid();

    return invoice;
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
