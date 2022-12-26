import { PaymentItem } from '@rytass/payments';
import { InvoiceCarrier, CustomsMark, TaxType } from '.';
import { Invoice } from './invoice';

export type InvoicePaymentItem = PaymentItem & {
  taxType?: TaxType.TAXED | TaxType.TAX_FREE | TaxType.ZERO_TAX | TaxType.SPECIAL;
}

export interface InvoiceVoidOptions {
  reason: string;
}

export interface InvoiceIssueOptions<I extends Invoice<PaymentItem>> {
  items: InvoicePaymentItem[];
  vatNumber?: string;
  carrier?: InvoiceCarrier;
  customsMark?: CustomsMark;
}

export interface InvoiceGateway<I extends Invoice<PaymentItem>> {
  issue(options: InvoiceIssueOptions<I>): Promise<I>;
  void(invoice: Invoice<PaymentItem>, options: InvoiceVoidOptions): Promise<Invoice<PaymentItem>>;

  // Utils
  isMobileBarcodeValid(code: string): Promise<boolean>;
  isLoveCodeValid(code: string): Promise<boolean>;
}
