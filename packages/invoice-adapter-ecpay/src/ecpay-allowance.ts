import { Invoice, InvoiceAllowance, InvoiceAllowanceState } from '@rytass/invoice';
import { ECPayInvoice } from './ecpay-invoice';
import { ECPayPaymentItem } from './typings';

export class ECPayInvoiceAllowance implements InvoiceAllowance<ECPayPaymentItem> {
  readonly allowanceNumber: string;

  readonly allowancePrice: number;

  readonly allowancedOn: Date;

  readonly remainingAmount: number;

  readonly items: ECPayPaymentItem[];

  readonly parentInvoice: ECPayInvoice;

  status = InvoiceAllowanceState.INITED;

  invalidOn: Date | null = null;

  constructor(options: Omit<InvoiceAllowance<ECPayPaymentItem>, 'invalidOn'> & { parentInvoice: ECPayInvoice }) {
    this.allowanceNumber = options.allowanceNumber;
    this.allowancePrice = options.allowancePrice;
    this.allowancedOn = options.allowancedOn;
    this.remainingAmount = options.remainingAmount;
    this.items = options.items;
    this.parentInvoice = options.parentInvoice;
    this.status = options.status;
  }
}
