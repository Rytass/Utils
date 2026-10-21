import { isAxiosError } from 'axios';
import { TurnkeyIssue } from './typings';

export interface TurnkeyInvoiceErrorOptions {
  message: string;
  status: number;
  code?: string;
  issues: TurnkeyIssue[];
}

export class TurnkeyInvoiceError extends Error {
  readonly status: number;

  readonly code: string | undefined;

  readonly issues: TurnkeyIssue[];

  constructor(options: TurnkeyInvoiceErrorOptions) {
    super(options.message);

    this.name = 'TurnkeyInvoiceError';
    this.status = options.status;
    this.code = options.code;
    this.issues = options.issues;
  }
}

const isTurnkeyIssue = (value: unknown): value is TurnkeyIssue =>
  typeof value === 'object' &&
  value !== null &&
  'code' in value &&
  typeof value.code === 'string' &&
  'message' in value &&
  typeof value.message === 'string' &&
  'field' in value &&
  typeof value.field === 'string';

const parseJsonBytes = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/** responseType 為 arraybuffer（證明聯下載）時，錯誤內容仍是 JSON 位元組，需先解碼。 */
const decodeErrorData = (data: unknown): unknown => {
  if (Buffer.isBuffer(data)) return parseJsonBytes(data.toString('utf8'));

  if (data instanceof ArrayBuffer) return parseJsonBytes(Buffer.from(data).toString('utf8'));

  return data;
};

const parseErrorBody = (data: unknown): { code?: string; message?: string; issues: TurnkeyIssue[] } => {
  if (typeof data !== 'object' || data === null) return { issues: [] };

  const code = 'code' in data && typeof data.code === 'string' ? data.code : undefined;
  const message = 'message' in data && typeof data.message === 'string' ? data.message : undefined;
  const issues = 'issues' in data && Array.isArray(data.issues) ? data.issues.filter(isTurnkeyIssue) : [];

  return { code, message, issues };
};

/**
 * 將 axios 錯誤轉為 TurnkeyInvoiceError（保留 HTTP status、error code 與 issues）。
 * 非 HTTP 回應的錯誤（逾時、連線失敗）原樣包成 Error 回傳。
 */
export const toTurnkeyError = (error: unknown): Error => {
  if (isAxiosError(error) && error.response) {
    const { status, data } = error.response;
    const body = parseErrorBody(decodeErrorData(data));

    return new TurnkeyInvoiceError({
      status,
      code: body.code,
      message: body.message ?? `Turnkey request failed with status ${status}`,
      issues: body.issues,
    });
  }

  return error instanceof Error ? error : new Error(String(error));
};
