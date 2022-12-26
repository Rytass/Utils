import { Invoice, InvoiceState, TaxType } from '@rytass/invoice';
import { EZPayInvoiceAllowance } from './ezpay-allowance';
import { EZPayInvoiceOptions, EZPayPaymentItem } from './typings';

export class EZPayInvoice implements Invoice<EZPayPaymentItem> {
  readonly invoiceNumber;

  readonly randomCode;

  readonly issuedOn: Date;

  readonly issuedAmount: number;

  readonly orderId: string;

  readonly taxType: TaxType;

  readonly platformId?: string;

  readonly allowances: EZPayInvoiceAllowance[] = [];

  readonly items: EZPayPaymentItem[];

  state = InvoiceState.ISSUED;

  voidOn: Date | null = null;

  nowAmount: number;

  constructor(options: EZPayInvoiceOptions) {
    this.issuedOn = options.issuedOn;
    this.items = options.items;
    this.nowAmount = options.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    this.issuedAmount = this.nowAmount;
    this.randomCode = options.randomCode;
    this.invoiceNumber = options.invoiceNumber;
    this.orderId = options.orderId;
    this.taxType = options.taxType;

    // Optional
    this.platformId = options.platformId;
  }

  public async setVoid(voidOn = new Date()): Promise<void> {
    this.state = InvoiceState.VOID;
    this.voidOn = voidOn;
  }

  public async addAllowance(allowance: EZPayInvoiceAllowance): Promise<void> {
    this.allowances.push(allowance);

    this.nowAmount = allowance.remainingAmount;
  }
}

