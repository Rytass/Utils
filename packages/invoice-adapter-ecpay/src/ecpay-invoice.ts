import { Invoice, InvoiceState } from '@rytass/invoice';
import { ECPayInvoiceAllowance } from './ecpay-allowance';
import { ECPayInvoiceOptions, ECPayPaymentItem } from './typings';

export class ECPayInvoice implements Invoice<ECPayPaymentItem> {
  readonly invoiceNumber;

  readonly randomCode;

  readonly issuedOn: Date;

  readonly issuedAmount: number;

  readonly orderId: string;

  readonly items: ECPayPaymentItem[];

  readonly allowances: ECPayInvoiceAllowance[] = [];

  state = InvoiceState.ISSUED;

  voidOn: Date | null = null;

  nowAmount: number;

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
