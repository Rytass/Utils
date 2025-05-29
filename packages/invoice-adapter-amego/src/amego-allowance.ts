import { AmegoInvoice } from './amego-invoice';
import { AmegoAllowanceOptions, AmegoPaymentItem } from './typings';
import { InvoiceAllowance, InvoiceAllowanceState } from '@rytass/invoice';

export class AmegoAllowance implements InvoiceAllowance<AmegoPaymentItem> {
  readonly allowanceNumber: string;

  readonly allowancePrice: number;

  readonly allowancedOn: Date;

  readonly _remainingAmount: number;

  get remainingAmount(): number {
    console.warn(
      'Amego not support remainingAmount query, this value is cached when allowance is created.',
    );

    return this._remainingAmount;
  }

  readonly _items: AmegoPaymentItem[];

  get items(): AmegoPaymentItem[] {
    console.warn(
      'Amego not support items query, this value is cached when allowance is created.',
    );

    return this._items;
  }

  readonly parentInvoice: AmegoInvoice;

  status: InvoiceAllowanceState;

  invalidOn: Date | null;

  constructor(options: AmegoAllowanceOptions) {
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
