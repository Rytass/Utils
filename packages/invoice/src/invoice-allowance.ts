import { Invoice } from './invoice';
import { InvoiceAllowanceState } from './typings';
import { PaymentItem } from '@rytass/payments';

export interface InvoiceAllowance<Item extends PaymentItem> {
  readonly allowanceNumber: string;

  readonly allowancePrice: number;

  readonly allowancedOn: Date;

  readonly remainingAmount: number;

  readonly items: Item[];

  readonly parentInvoice: Invoice<Item>;

  status: InvoiceAllowanceState;

  invalidOn: Date | null;

  invalid: () => void;
}
