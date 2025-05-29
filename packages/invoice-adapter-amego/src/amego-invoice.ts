import { Invoice, InvoiceAllowance, InvoiceAwardType, InvoiceState, PaymentItem, TaxType } from '@rytass/invoice';
import { AmegoInvoiceOptions, AmegoPaymentItem } from './typings';

export class AmegoInvoice implements Invoice<AmegoPaymentItem> {

  invoiceNumber: string;

  readonly issuedOn: Date;

  readonly allowances: InvoiceAllowance<PaymentItem>[];

  readonly issuedAmount: number;

  randomCode: string;

  readonly items: AmegoPaymentItem[];

  state = InvoiceState.ISSUED;

  nowAmount: number;

  voidOn: Date | null = null;

  readonly orderId: string;

  readonly taxType: TaxType;

  constructor(options: AmegoInvoiceOptions) {
    this.issuedOn = options.issuedOn ?? new Date();
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

  public setVoid(voidOn = new Date()): void {
    this.voidOn = voidOn;
    this.state = InvoiceState.VOID;
  }

  awardType?: InvoiceAwardType | undefined;
}
