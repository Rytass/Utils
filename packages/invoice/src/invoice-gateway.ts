import { PaymentItem } from '@rytass/payments';
import {
  InvoiceCarrier,
  CustomsMark,
  InvoicePaymentItem,
  InvoiceVoidOptions,
  InvoiceAllowanceOptions,
} from './typings';
import { Invoice } from './invoice';
import { InvoiceAllowance } from './invoice-allowance';

// Base interface for invoice query options - flexible approach to support all adapters
export interface BaseInvoiceQueryOptions {
  orderId?: string;
  invoiceNumber?: string;
  [key: string]: unknown;
}

export type InvoiceQueryOptions<T = BaseInvoiceQueryOptions> = T;

export interface InvoiceIssueOptions<Item extends PaymentItem = PaymentItem> {
  items: InvoicePaymentItem<Item>[];
  vatNumber?: string;
  carrier?: InvoiceCarrier;
  customsMark?: CustomsMark;
}

export interface InvoiceGateway<
  Item extends PaymentItem = PaymentItem,
  I extends Invoice<Item> = Invoice<Item>,
  QueryOptions = unknown,
> {
  issue(options: InvoiceIssueOptions<Item>): Promise<I>;
  void(invoice: Invoice<PaymentItem>, options: InvoiceVoidOptions): Promise<Invoice<PaymentItem>>;
  allowance(
    invoice: Invoice<PaymentItem>,
    allowanceItems: InvoicePaymentItem[],
    options?: InvoiceAllowanceOptions,
  ): Promise<Invoice<PaymentItem>>;
  invalidAllowance(allowance: InvoiceAllowance<PaymentItem>): Promise<Invoice<PaymentItem>>;
  query(options: QueryOptions): Promise<I>;

  // Utils
  isMobileBarcodeValid(code: string): Promise<boolean>;
  isLoveCodeValid(code: string): Promise<boolean>;
}
