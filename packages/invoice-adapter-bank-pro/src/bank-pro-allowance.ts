import { BankProInvoice } from './bank-pro-invoice';
import { BankProAllowanceOptions, BankProPaymentItem } from './typings';
import { InvoiceAllowance, InvoiceAllowanceState } from '@rytass/invoice';

export class BankProAllowance implements InvoiceAllowance<BankProPaymentItem> {
  readonly allowanceNumber: string;

  readonly allowancePrice: number;

  readonly allowancedOn: Date;

  readonly _remainingAmount: number;

  get remainingAmount(): number {
    console.warn(
      'BankPro not support remainingAmount query, this value is cached when allowance is created.',
    );

    return this._remainingAmount;
  }

  readonly _items: BankProPaymentItem[];

  get items(): BankProPaymentItem[] {
    console.warn(
      'BankPro not support items query, this value is cached when allowance is created.',
    );

    return this._items;
  }

  readonly parentInvoice: BankProInvoice;

  status: InvoiceAllowanceState;

  invalidOn: Date | null;

  constructor(options: BankProAllowanceOptions) {
    this.allowanceNumber = options.allowanceNumber;
    this.allowancePrice = options.allowancePrice;
    this.allowancedOn = options.allowancedOn;
    this._items = options.items;
    this._remainingAmount =
      options.parentInvoice.issuedAmount - this.allowancePrice;

    this.parentInvoice = options.parentInvoice;
    this.status = options.status;
    this.invalidOn = options.invalidOn ?? null;
  }

  invalid: () => void;
}
