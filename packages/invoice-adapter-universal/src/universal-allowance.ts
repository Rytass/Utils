import { InvoiceAllowance, InvoiceAllowanceState } from '@rytass/invoice';
import { UniversalInvoice } from './universal-invoice';
import { UniversalAllowanceOptions, UniversalPaymentItem } from './typings';

export class UniversalAllowance implements InvoiceAllowance<UniversalPaymentItem> {
  readonly allowanceNumber: string;

  readonly allowanceDate: string;

  readonly allowancePrice: number;

  readonly allowancedOn: Date;

  readonly remainingAmount: number;

  readonly items: UniversalPaymentItem[];

  readonly parentInvoice: UniversalInvoice;

  readonly salesReturnID: string;

  status: InvoiceAllowanceState;

  invalidOn: Date | null;

  constructor(options: UniversalAllowanceOptions) {
    this.allowanceNumber = options.allowanceNumber;
    this.allowanceDate = options.allowanceDate;
    this.allowancePrice = options.allowancePrice;
    this.allowancedOn = options.allowancedOn;
    this.remainingAmount = options.remainingAmount;
    this.items = options.items;
    this.parentInvoice = options.parentInvoice;
    this.status = options.status;
    this.invalidOn = options.invalidOn;
    this.salesReturnID = options.salesReturnID;
  }

  invalid(invalidOn = new Date()): void {
    this.invalidOn = invalidOn;
    this.status = InvoiceAllowanceState.INVALID;
    this.parentInvoice.nowAmount += this.allowancePrice;
  }
}
