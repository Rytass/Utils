import { Invoice, InvoiceAllowance, InvoiceState } from '@rytass/invoice';
import { ECPayInvoiceOptions, ECPayPaymentItem } from './typings';

export class ECPayInvoice implements Invoice<ECPayPaymentItem> {
  state = InvoiceState.ISSUED;

  readonly invoiceNumber;

  readonly randomCode;

  readonly issuedOn: Date;

  readonly issuedAmount: number;

  readonly orderId: string;

  voidOn: Date | null = null;

  allowances: InvoiceAllowance[] = [];

  nowAmount: number;

  items: ECPayPaymentItem[];

  constructor(options: ECPayInvoiceOptions) {
    this.issuedOn = options.issuedOn;
    this.items = options.items;
    this.nowAmount = options.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    this.issuedAmount = this.nowAmount;
    this.randomCode = options.randomCode;
    this.invoiceNumber = options.invoiceNumber;
    this.orderId = options.orderId;
  }

  setVoid() {
    this.state = InvoiceState.VOID;
    this.voidOn = new Date();
  }
}
