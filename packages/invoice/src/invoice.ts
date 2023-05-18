import { PaymentItem } from '@rytass/payments';
import { InvoiceAwardType, InvoiceState } from './typings';
import { InvoiceAllowance } from './invoice-allowance';

export interface Invoice<Item extends PaymentItem> {
  readonly invoiceNumber: string;

  readonly issuedOn: Date;

  readonly allowances: InvoiceAllowance<PaymentItem>[];

  readonly issuedAmount: number;

  readonly randomCode: string;

  readonly items: Item[];

  state: InvoiceState;

  nowAmount: number;

  voidOn: Date | null;

  setVoid: () => void;

  awardType?: InvoiceAwardType;
}
