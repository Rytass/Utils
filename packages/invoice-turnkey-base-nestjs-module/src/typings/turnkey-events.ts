export enum TurnkeyEvents {
  SUBMISSION_ACCEPTED = 'submission.accepted',
  SUBMISSION_REJECTED = 'submission.rejected',
  SUBMISSION_FAILED = 'submission.failed',
  /** 寫進 UpCast 很久仍沒有任何結果（Turnkey 沒撿檔或沒留 log），需要人工查看 */
  SUBMISSION_STALLED = 'submission.stalled',
  INVOICE_ISSUED = 'invoice.issued',
  INVOICE_CONFIRMED = 'invoice.confirmed',
  INVOICE_REJECTED = 'invoice.rejected',
  INVOICE_VOIDED = 'invoice.voided',
  INVOICE_ANNULLED = 'invoice.annulled',
  ALLOWANCE_ISSUED = 'allowance.issued',
  ALLOWANCE_CONFIRMED = 'allowance.confirmed',
  ALLOWANCE_VOIDED = 'allowance.voided',
  RECEIVED_INVOICE_ARRIVED = 'received-invoice.arrived',
  RECEIVED_INVOICE_VOID_REQUESTED = 'received-invoice.void-requested',
  RECEIVED_INVOICE_REJECTION_ACKNOWLEDGED = 'received-invoice.rejection-acknowledged',
  RECEIVED_ALLOWANCE_ARRIVED = 'received-allowance.arrived',
  RECEIVED_ALLOWANCE_VOID_REQUESTED = 'received-allowance.void-requested',
  RECONCILIATION_COMPLETED = 'reconciliation.completed',
  INVOICE_TRACK_RUNNING_LOW = 'invoice-track.running-low',
  CERTIFICATE_EXPIRING = 'certificate.expiring',
}

export interface TurnkeyEvent<T = Record<string, unknown>> {
  /** outbox 流水號，可用來去重與當作游標 */
  readonly id: string;
  readonly type: TurnkeyEvents;
  readonly companyTaxId: string;
  readonly data: T;
  readonly createdAt: Date;
}
