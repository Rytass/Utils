import { InvoiceState, InvoiceAllowance, PaymentItem } from '.';

export interface Invoice<Item extends PaymentItem> {
  state: InvoiceState;

  invoiceNumber: string;

  issuedOn: Date;

  voidOn: Date | null;

  allowances: InvoiceAllowance[];

  issuedAmount: number;

  nowAmount: number;

  randomCode: string;

  items: Item[];
}
