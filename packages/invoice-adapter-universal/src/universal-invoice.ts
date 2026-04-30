import { Invoice, InvoiceState, TaxType } from '@rytass/invoice';
import { UniversalAllowance } from './universal-allowance';
import { UniversalInvoiceOptions, UniversalPaymentItem } from './typings';

export class UniversalInvoice implements Invoice<UniversalPaymentItem> {
  readonly invoiceNumber: string;

  readonly issuedOn: Date;

  readonly allowances: UniversalAllowance[];

  readonly issuedAmount: number;

  readonly randomCode: string;

  readonly items: UniversalPaymentItem[];

  readonly orderId: string;

  readonly sellerID: string;

  readonly buyerID: string;

  readonly buyerName?: string;

  readonly taxType: TaxType;

  state = InvoiceState.ISSUED;

  nowAmount: number;

  voidOn: Date | null = null;

  constructor(options: UniversalInvoiceOptions) {
    this.invoiceNumber = options.invoiceNumber;
    this.issuedOn = options.issuedOn;
    this.allowances = options.allowances ?? [];
    this.randomCode = options.randomCode;
    this.items = options.items;
    this.orderId = options.orderId;
    this.sellerID = options.sellerID;
    this.buyerID = options.buyerID;
    this.buyerName = options.buyerName;
    this.taxType = options.taxType;
    this.state = options.state ?? this.state;
    this.voidOn = options.voidOn ?? null;
    this.issuedAmount = options.items.reduce((sum, item) => sum + Math.round(item.unitPrice * item.quantity), 0);
    this.nowAmount =
      this.issuedAmount -
      this.allowances.reduce((sum, allowance) => {
        if (allowance.status === 'ISSUED') return sum + allowance.allowancePrice;

        return sum;
      }, 0);
  }

  setVoid(voidOn = new Date()): void {
    this.voidOn = voidOn;
    this.state = InvoiceState.VOID;
  }

  addAllowance(allowance: UniversalAllowance): void {
    this.allowances.push(allowance);
    this.nowAmount = allowance.remainingAmount;
    this.state = InvoiceState.ALLOWANCED;
  }
}
