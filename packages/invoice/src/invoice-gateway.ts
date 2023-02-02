import { PaymentItem } from '@rytass/payments';
import { InvoiceCarrier, CustomsMark, InvoicePaymentItem, InvoiceVoidOptions, InvoiceAllowanceOptions, InvoiceAllowance } from '.';
import { Invoice } from './invoice';

export interface InvoiceIssueOptions<I extends Invoice<PaymentItem>> {
  items: InvoicePaymentItem[];
  vatNumber?: string;
  carrier?: InvoiceCarrier;
  customsMark?: CustomsMark;
}

export interface InvoiceGateway<I extends Invoice<PaymentItem>, QueryOptions> {
  issue(options: InvoiceIssueOptions<I>): Promise<I>;
  void(invoice: Invoice<PaymentItem>, options: InvoiceVoidOptions): Promise<Invoice<PaymentItem>>;
  allowance(invoice: Invoice<PaymentItem>, allowanceItems: InvoicePaymentItem[], options?: InvoiceAllowanceOptions): Promise<Invoice<PaymentItem>>;
  invalidAllowance(allowance: InvoiceAllowance<PaymentItem>): Promise<Invoice<PaymentItem>>;
  query(options: QueryOptions): Promise<I>;

  // Utils
  isMobileBarcodeValid(code: string): Promise<boolean>;
  isLoveCodeValid(code: string): Promise<boolean>;
}
