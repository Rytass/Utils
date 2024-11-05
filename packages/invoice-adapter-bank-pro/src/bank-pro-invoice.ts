import { Invoice, InvoiceState, TaxType } from '@rytass/invoice';
import { BankProInvoiceOptions, BankProPaymentItem } from './typings';

export class BankProInvoice implements Invoice<BankProPaymentItem> {
  readonly invoiceNumber;

  readonly randomCode;

  readonly issuedOn: Date;

  readonly issuedAmount: number;

  readonly orderId: string;

  readonly taxType: TaxType;

  readonly platformId?: string;

  readonly allowances: any[] = [];

  readonly items: BankProPaymentItem[];

  state = InvoiceState.ISSUED;

  voidOn: Date | null = null;

  nowAmount: number;

  constructor(options: BankProInvoiceOptions) {
    this.issuedOn = options.issuedOn;
    this.items = options.items;
    this.nowAmount = options.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    this.issuedAmount = this.nowAmount;
    this.randomCode = options.randomCode;
    this.invoiceNumber = options.invoiceNumber;
    this.orderId = options.orderId;
    this.taxType = options.taxType;
    this.voidOn = options.voidOn ?? null;
    this.state = options.state ?? this.state;
  }

  public setVoid(voidOn = new Date()): void {}
}
