export enum TurnkeyValidationCode {
  ITEM_SUM_MISMATCH = 'ITEM_SUM_MISMATCH',
  TAX_AMOUNT_MISMATCH = 'TAX_AMOUNT_MISMATCH',
  TOTAL_AMOUNT_MISMATCH = 'TOTAL_AMOUNT_MISMATCH',
  INVALID_TAX_ID = 'INVALID_TAX_ID',
  INVALID_CARRIER = 'INVALID_CARRIER',
  /** 捐贈碼不是 3 到 7 位數字。只檢查格式，不查捐贈碼是否存在 */
  UNKNOWN_NPO_CODE = 'UNKNOWN_NPO_CODE',
  ALLOWANCE_EXCEEDS_INVOICE = 'ALLOWANCE_EXCEEDS_INVOICE',
  ALLOWANCE_AMOUNT_INVALID = 'ALLOWANCE_AMOUNT_INVALID',
  /** @deprecated 折讓的買方一律取自原發票，不會發生不一致；本代碼不會被拋出 */
  ALLOWANCE_BUYER_MISMATCH = 'ALLOWANCE_BUYER_MISMATCH',
  INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',
  /** 指定的號碼不在此營業人登錄的任何字軌內（例如放棄號碼時） */
  NUMBER_OUT_OF_TRACK = 'NUMBER_OUT_OF_TRACK',
  NUMBER_ALREADY_REPORTED_BLANK = 'NUMBER_ALREADY_REPORTED_BLANK',
  DATE_OUT_OF_ORDER = 'DATE_OUT_OF_ORDER',
  ISSUE_DEADLINE_PASSED = 'ISSUE_DEADLINE_PASSED',
  ISSUED_IN_FUTURE = 'ISSUED_IN_FUTURE',
  ZERO_RATED_FIELDS_REQUIRED = 'ZERO_RATED_FIELDS_REQUIRED',
  PRINT_MARK_REQUIRED = 'PRINT_MARK_REQUIRED',
  BUYER_TAX_ID_REQUIRED = 'BUYER_TAX_ID_REQUIRED',
  TAX_TYPE_NOT_ALLOWED = 'TAX_TYPE_NOT_ALLOWED',
  DONATION_NOT_ALLOWED = 'DONATION_NOT_ALLOWED',
  /** 要求 EXCHANGE，但賣方（開立的營業人）的 exchangeEnabled 為 false。名稱沿用舊版，檢查的是賣方 */
  BUYER_NOT_EXCHANGE_READY = 'BUYER_NOT_EXCHANGE_READY',
  /** 發票與折讓（F0401、G0401、A0101、B0101）都必須帶賣方地址；營業人資料沒有 address 時拒絕，號碼不會用掉 */
  SELLER_ADDRESS_REQUIRED = 'SELLER_ADDRESS_REQUIRED',
  NO_AVAILABLE_NUMBER = 'NO_AVAILABLE_NUMBER',
  INVALID_STATE = 'INVALID_STATE',
  COMPANY_NOT_REGISTERED = 'COMPANY_NOT_REGISTERED',
  INVALID_TRACK = 'INVALID_TRACK',
  /** 期別不是民國年 3 碼＋雙數月（例如 11510） */
  INVALID_PERIOD = 'INVALID_PERIOD',
  SUBMISSION_NOT_FOUND = 'SUBMISSION_NOT_FOUND',
  /** 同一個 externalId 已開過內容不同的發票 */
  EXTERNAL_ID_CONFLICT = 'EXTERNAL_ID_CONFLICT',
}

export interface TurnkeyValidationIssue {
  readonly code: TurnkeyValidationCode;
  readonly message: string;
  readonly field?: string;
}

/** 檢核失敗；REST 轉成 422，號碼不會用掉 */
export class TurnkeyValidationError extends Error {
  constructor(readonly issues: readonly TurnkeyValidationIssue[]) {
    super(issues.map(issue => `${issue.code}: ${issue.message}`).join('; '));

    this.name = 'TurnkeyValidationError';
  }

  get code(): TurnkeyValidationCode {
    return this.issues[0].code;
  }

  get field(): string | undefined {
    return this.issues[0].field;
  }
}
