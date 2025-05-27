import {
  Invoice,
  InvoiceAllowance,
  InvoiceAllowanceOptions,
  InvoiceGateway,
  InvoicePaymentItem,
  InvoiceVoidOptions,
  PaymentItem
} from '@rytass/invoice';
import axios from 'axios';
import { DateTime } from 'luxon';
import { createHash } from 'crypto';

import { AmegoInvoice } from './amego-invoice';
import {
  AmegoBaseUrls,
  AmegoInvoiceGatewayOptions,
  AmegoInvoiceIssueOptions,
  AmegoInvoiceVoidOptions,
  AmegoPaymentItem,
} from './typings';

export class AmegoInvoiceGateway
  implements
  InvoiceGateway<AmegoPaymentItem, AmegoInvoice> {

  private readonly baseUrl: string = AmegoBaseUrls.DEVELOPMENT;

  private readonly vatNumber: string;
  private readonly appKey: string;

  constructor(options: AmegoInvoiceGatewayOptions) {

    this.baseUrl = options?.baseUrl || this.baseUrl;

    if (!options.appKey) {
      throw new Error('App key is required');
    }

    if (!options.vatNumber) {
      throw new Error('VAT number is required');
    }

    this.vatNumber = options.vatNumber;
    this.appKey = options.appKey;
  }


  allowance(invoice: Invoice<PaymentItem>, allowanceItems: InvoicePaymentItem[], options?: InvoiceAllowanceOptions): Promise<Invoice<PaymentItem>> {
    throw new Error('Method not implemented.');
  }
  invalidAllowance(allowance: InvoiceAllowance<PaymentItem>): Promise<Invoice<PaymentItem>> {
    throw new Error('Method not implemented.');
  }
  query(options: any): Promise<AmegoInvoice> {
    throw new Error('Method not implemented.');
  }
  isLoveCodeValid(code: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async issue(options: AmegoInvoiceIssueOptions): Promise<AmegoInvoice> {
    throw new Error('Method not implemented.');
  }

  async isMobileBarcodeValid(code: string): Promise<boolean> {
    const apiData = JSON.stringify({
      barCode: code,
    });

    const encodedPayload = this.generateEncodedPayload(apiData);

    const { data } = await axios.post<{ code: number, msg: string }>(
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

  void(invoice: AmegoInvoice): Promise<Invoice<PaymentItem>> {
    console.warn(`invoice ${JSON.stringify(invoice)}`);
    // console.warn(`options ${JSON.stringify(options)}`);

    throw new Error('Method not implemented.');
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
