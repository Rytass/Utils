import { Invoice, InvoiceAwardType, InvoiceState, TaxType } from '@rytass/invoice';
import { ECPayInvoiceAllowance } from './ecpay-allowance';
import { ECPayInvoiceOptions, ECPayPaymentItem } from './typings';

export class ECPayInvoice implements Invoice<ECPayPaymentItem> {
  readonly invoiceNumber;

  readonly randomCode;

  readonly issuedOn: Date;

  readonly issuedAmount: number;

  readonly orderId: string;

  readonly taxType: TaxType;

  readonly items: ECPayPaymentItem[];

  readonly allowances: ECPayInvoiceAllowance[] = [];

  state = InvoiceState.ISSUED;

  voidOn: Date | null = null;

  nowAmount: number;

  awardType?: InvoiceAwardType;

  constructor(options: ECPayInvoiceOptions) {
    this.issuedOn = options.issuedOn;
    this.items = options.items;
    this.nowAmount = options.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    this.issuedAmount = this.nowAmount;
    this.randomCode = options.randomCode;
    this.invoiceNumber = options.invoiceNumber;
    this.orderId = options.orderId;
    this.taxType = options.taxType;
    this.awardType = options.awardType;

    if (options.isVoid) {
      this.setVoid();
    }
  }

  setVoid(): void {
    this.state = InvoiceState.VOID;
    this.voidOn = new Date();
  }

  public async addAllowance(allowance: ECPayInvoiceAllowance): Promise<void> {
    this.allowances.push(allowance);

    this.nowAmount = allowance.remainingAmount;
  }
}
