import { Invoice, InvoiceAllowanceState, InvoiceState, TaxType } from '@rytass/invoice';
import { TurnkeyInvoiceAllowance } from './turnkey-allowance';
import { TurnkeyInvoiceStatus, TurnkeyPaymentItem } from './typings';

export interface TurnkeyInvoiceOptions {
  invoiceNumber: string;
  randomCode: string;
  issuedOn: Date;
  issuedAmount: number;
  items: TurnkeyPaymentItem[];
  taxType: TaxType;
  externalId: string | null;
  turnkeyStatus: TurnkeyInvoiceStatus;
  state: InvoiceState;
  voidOn?: Date | null;
}

export class TurnkeyInvoice implements Invoice<TurnkeyPaymentItem> {
  readonly invoiceNumber: string;

  readonly randomCode: string;

  readonly issuedOn: Date;

  readonly issuedAmount: number;

  readonly items: TurnkeyPaymentItem[];

  readonly taxType: TaxType;

  /** 呼叫端的訂單編號（Turnkey externalId）。 */
  readonly externalId: string | null;

  allowances: TurnkeyInvoiceAllowance[] = [];

  state: InvoiceState;

  nowAmount: number;

  voidOn: Date | null;

  /** Turnkey 原始發票狀態，用來區分 SUBMITTED / CONFIRMED / VOID_PENDING 等細部狀態。 */
  turnkeyStatus: TurnkeyInvoiceStatus;

  constructor(options: TurnkeyInvoiceOptions) {
    this.invoiceNumber = options.invoiceNumber;
    this.randomCode = options.randomCode;
    this.issuedOn = options.issuedOn;
    this.issuedAmount = options.issuedAmount;
    this.nowAmount = options.issuedAmount;
    this.items = options.items;
    this.taxType = options.taxType;
    this.externalId = options.externalId;
    this.state = options.state;
    this.voidOn = options.voidOn ?? null;
    this.turnkeyStatus = options.turnkeyStatus;
  }

  setVoid(voidOn: Date = new Date()): void {
    this.state = InvoiceState.VOID;
    this.voidOn = voidOn;
  }

  addAllowance(allowance: TurnkeyInvoiceAllowance): void {
    this.allowances = [...this.allowances, allowance];

    this.nowAmount = allowance.remainingAmount;

    this.syncAllowanceState();
  }

  /**
   * 有尚未作廢的折讓時為 ALLOWANCED；全部作廢後回到 ISSUED。已作廢（VOID）的發票不變。
   * 由 addAllowance 與折讓作廢時呼叫。
   */
  syncAllowanceState(): void {
    if (this.state === InvoiceState.VOID) return;

    const hasActiveAllowance = this.allowances.some(allowance => allowance.status !== InvoiceAllowanceState.INVALID);

    if (hasActiveAllowance) {
      this.state = InvoiceState.ALLOWANCED;
    } else if (this.state === InvoiceState.ALLOWANCED) {
      this.state = InvoiceState.ISSUED;
    }
  }
}
