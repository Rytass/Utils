import { Invoice, InvoiceAllowance, InvoiceAllowanceState } from '@rytass/invoice';
import { EZPayInvoice } from './ezpay-invoice';
import { EZPayPaymentItem } from './typings';

export class EZPayInvoiceAllowance implements InvoiceAllowance<EZPayPaymentItem> {
  readonly allowanceNumber: string;

  readonly allowancePrice: number;

  readonly allowancedOn: Date;

  readonly remainingAmount: number;

  readonly items: EZPayPaymentItem[];

  readonly parentInvoice: EZPayInvoice;

  status = InvoiceAllowanceState.INITED;

  invalidOn: Date | null = null;

  constructor(options: Omit<InvoiceAllowance<EZPayPaymentItem>, 'invalidOn'> & { parentInvoice: EZPayInvoice }) {
    this.allowanceNumber = options.allowanceNumber;
    this.allowancePrice = options.allowancePrice;
    this.allowancedOn = options.allowancedOn;
    this.remainingAmount = options.remainingAmount;
    this.items = options.items;
    this.parentInvoice = options.parentInvoice;
    this.status = options.status;
  }

  invalid(invalidOn = new Date()) {
    this.invalidOn = invalidOn;
    this.status = InvoiceAllowanceState.INVALID;

    this.parentInvoice.nowAmount += this.allowancePrice;
  }
}
