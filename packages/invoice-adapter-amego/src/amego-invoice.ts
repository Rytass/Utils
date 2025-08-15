import { Invoice, InvoiceAllowance, InvoiceAllowanceState, InvoiceAwardType, InvoiceState, PaymentItem, TaxType } from '@rytass/invoice';
import { AmegoInvoiceOptions, AmegoPaymentItem, AMEGO_CONSTANTS } from './typings';
import { AmegoAllowance } from './amego-allowance';

export class AmegoInvoice implements Invoice<AmegoPaymentItem> {

  invoiceNumber: string;

  readonly issuedOn: Date;

  readonly allowances: AmegoAllowance[];

  accumulatedAllowances: AmegoAllowance[] = [];

  readonly issuedAmount: number;

  randomCode: string;

  readonly items: AmegoPaymentItem[];

  state = InvoiceState.ISSUED;

  nowAmount: number;

  voidOn: Date | null = null;

  readonly orderId: string;

  readonly taxType: TaxType;

  readonly vatNumber: string;

  readonly taxRate: number;

  readonly taxAmount: number = 0;

  readonly carrier?: {
    type: string;
    code: string;
  };

  constructor(options: AmegoInvoiceOptions) {
    this.issuedOn = options.issuedOn ?? new Date();
    this.items = options.items ?? [];

    const issuedAmount = options.items.reduce(
      (sum, item) => { return sum + item.quantity * item.unitPrice; },
      0,
    );

    const totalAllowanceAmount = options.allowances?.reduce(
      (sum, allowance) => {
        if (allowance.status !== InvoiceAllowanceState.ISSUED) {
          return sum; // 忽略無效的折讓
        }

        if (allowance.invoiceType.endsWith('0401')) {
          return sum + allowance.allowancePrice;
        }

        return sum - allowance.allowancePrice;
      },
      0,
    ) ?? 0;

    this.nowAmount = issuedAmount - totalAllowanceAmount;
    this.allowances = options.allowances ?? [];
    this.issuedAmount = issuedAmount;
    this.randomCode = options.randomCode;
    this.invoiceNumber = options.invoiceNumber;
    this.orderId = options.orderId;
    this.taxType = options.taxType;
    this.voidOn = options.voidOn ?? null;
    this.state = options.state ?? this.state;
    this.vatNumber = options.vatNumber ?? '0000000000';
    this.taxRate = options.taxRate ?? AMEGO_CONSTANTS.DEFAULT_TAX_RATE; // Default tax rate is 5%
    this.taxAmount = options.items.reduce((sum, item) => {
      if (item.taxType === TaxType.TAXED) {
        const thisItemTax = Math.round((item.unitPrice * item.quantity * this.taxRate) / (1 + this.taxRate));

        return sum + thisItemTax;
      }

      return sum;
    }, 0);

    this.carrier = options.carrier;
  }

  public setVoid(voidOn = new Date()): void {
    this.voidOn = voidOn;
    this.state = InvoiceState.VOID;
  }

  awardType?: InvoiceAwardType | undefined;
}
