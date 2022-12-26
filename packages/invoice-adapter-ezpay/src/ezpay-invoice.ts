import { Invoice, InvoiceAllowance, InvoiceState } from '@rytass/invoice';
import { EZPayInvoiceGateway } from './ezpay-invoice-gateway';
import { EZPayInvoiceOptions, EZPayPaymentItem } from './typings';

export class EZPayInvoice implements Invoice<EZPayPaymentItem> {
  state = InvoiceState.ISSUED;

  readonly invoiceNumber;

  readonly randomCode;

  readonly issuedOn: Date;

  readonly issuedAmount: number;

  readonly orderId: string;

  readonly platformId?: string;

  voidOn: Date | null = null;

  allowances: InvoiceAllowance[] = [];

  nowAmount: number;

  items: EZPayPaymentItem[];

  constructor(options: EZPayInvoiceOptions) {
    this.issuedOn = options.issuedOn;
    this.items = options.items;
    this.nowAmount = options.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    this.issuedAmount = this.nowAmount;
    this.randomCode = options.randomCode;
    this.invoiceNumber = options.invoiceNumber;
    this.orderId = options.orderId;

    // Optional
    this.platformId = options.platformId;
  }

  public async setVoid(voidOn = new Date()): Promise<void> {
    this.state = InvoiceState.VOID;
    this.voidOn = voidOn;
  }
}

