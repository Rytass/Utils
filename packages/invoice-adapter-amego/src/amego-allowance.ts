import { AmegoInvoice } from './amego-invoice';
import { AmegoAllowanceOptions, AmegoPaymentItem } from './typings';
import { InvoiceAllowance, InvoiceAllowanceState } from '@rytass/invoice';

export class AmegoAllowance implements InvoiceAllowance<AmegoPaymentItem> {
  readonly allowanceNumber: string;

  readonly allowancePrice: number;

  readonly allowancedOn: Date;

  readonly invoiceType: string;

  readonly _remainingAmount: number;

  get remainingAmount(): number {
    return this._remainingAmount;
  }

  readonly _items: AmegoPaymentItem[];

  get items(): AmegoPaymentItem[] {
    return this._items;
  }

  readonly parentInvoice: AmegoInvoice;

  status: InvoiceAllowanceState;

  invalidOn: Date | null;

  constructor(options: AmegoAllowanceOptions) {
    this.invoiceType = options.invoiceType ?? 'G0401'; // Default to G0401 if not provided
    this.allowanceNumber = options.allowanceNumber;
    this.allowancePrice = options.allowancePrice;
    this.allowancedOn = options.allowancedOn;
    this._items = options.items;
    this.parentInvoice = options.parentInvoice;

    this._remainingAmount =
      options.parentInvoice.issuedAmount - options.parentInvoice.accumulatedAllowances.reduce(
        (sum, allowance) => sum + allowance.allowancePrice,
        0,
      );

    this.status = options.status;
    this.invalidOn = options.invalidOn ?? null;
  }

  invalid: () => void = () => {
    this.status = InvoiceAllowanceState.INVALID;
    this.invalidOn = new Date();
    this.parentInvoice.nowAmount += this.allowancePrice;
  }
}
