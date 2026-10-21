import { InvoiceAllowance, InvoiceAllowanceState } from '@rytass/invoice';
import { TurnkeyInvoice } from './turnkey-invoice';
import { TurnkeyAllowanceStatus, TurnkeyPaymentItem } from './typings';

export interface TurnkeyInvoiceAllowanceOptions {
  allowanceNumber: string;
  allowancePrice: number;
  allowancedOn: Date;
  remainingAmount: number;
  items: TurnkeyPaymentItem[];
  parentInvoice: TurnkeyInvoice;
  status: InvoiceAllowanceState;
  turnkeyStatus: TurnkeyAllowanceStatus;
  invalidOn?: Date | null;
}

export class TurnkeyInvoiceAllowance implements InvoiceAllowance<TurnkeyPaymentItem> {
  readonly allowanceNumber: string;

  readonly allowancePrice: number;

  readonly allowancedOn: Date;

  readonly remainingAmount: number;

  readonly items: TurnkeyPaymentItem[];

  readonly parentInvoice: TurnkeyInvoice;

  status: InvoiceAllowanceState;

  invalidOn: Date | null = null;

  /** Turnkey 原始折讓狀態（SUBMITTED / ISSUED / CONFIRMED / VOID_PENDING / VOIDED 等）。 */
  turnkeyStatus: TurnkeyAllowanceStatus;

  constructor(options: TurnkeyInvoiceAllowanceOptions) {
    this.allowanceNumber = options.allowanceNumber;
    this.allowancePrice = options.allowancePrice;
    this.allowancedOn = options.allowancedOn;
    this.remainingAmount = options.remainingAmount;
    this.items = options.items;
    this.parentInvoice = options.parentInvoice;
    this.status = options.status;
    this.turnkeyStatus = options.turnkeyStatus;
    this.invalidOn = options.invalidOn ?? null;
  }

  invalid(invalidOn: Date = new Date()): void {
    if (this.status === InvoiceAllowanceState.INVALID) return;

    this.invalidOn = invalidOn;
    this.status = InvoiceAllowanceState.INVALID;

    this.parentInvoice.nowAmount += this.allowancePrice;
    this.parentInvoice.syncAllowanceState();
  }
}
