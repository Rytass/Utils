import { FUSION_ERP_OPERATIONS, FUSION_FINDERS, FUSION_RESOURCES } from '../constants/resources';
import {
  FusionAuthError,
  FusionSoapFaultError,
  FusionTransientError,
  FusionValidationError,
} from '../errors/fusion-errors';
import { FusionApiOperation, FusionApiOutcome } from '../typings/call-log';
import type { FusionHttpMethod } from '../typings/call-log';

/** 預設要從回應擷取到 `refs` 的欄位名（`erpintegrations` 情境）。 */
export const DEFAULT_RESPONSE_REF_KEYS: readonly string[] = ['ReqstId', 'JeBatchId'];

export const DEFAULT_MAX_TEXT_LENGTH = 2000;

/** 預設的回應摘要白名單；刻意排除 `DocumentContent`（base64 檔案內容）等大型／機密欄位。 */
export const DEFAULT_RESPONSE_SUMMARY_KEYS: readonly string[] = [
  'ReqstId',
  'JeBatchId',
  'Status',
  'StatusMeaning',
  'PostedDate',
  'RequestStatus',
];

function truncate(value: string, max: number = DEFAULT_MAX_TEXT_LENGTH): string {
  return value.length > max ? value.slice(0, max) : value;
}

/** `endpoint` 一律去除 query string（呼叫方業務參數應由 correlation／ref 欄位承載）。 */
export function redactEndpoint(pathWithQuery: string): string {
  const idx = pathWithQuery.indexOf('?');

  return idx === -1 ? pathWithQuery : pathWithQuery.slice(0, idx);
}

/**
 * 內建的 Fusion ERP 操作分類規則。消費端若有不同的資源集合，可用
 * `FusionClientOptions.operationResolver` 覆寫，不需修改本函式。
 */
export function deriveOperation(
  httpMethod: FusionHttpMethod,
  pathWithQuery: string,
  body?: unknown,
): FusionApiOperation {
  const basePath = redactEndpoint(pathWithQuery);

  if (httpMethod === 'POST' && basePath === FUSION_RESOURCES.ERP_INTEGRATIONS) {
    const operationName =
      body && typeof body === 'object' && 'OperationName' in body
        ? (body as Record<string, unknown>)['OperationName']
        : null;

    if (operationName === FUSION_ERP_OPERATIONS.IMPORT_BULK_DATA) return FusionApiOperation.IMPORT_BULK_DATA;

    if (operationName === FUSION_ERP_OPERATIONS.SUBMIT_ESS_JOB_REQUEST) return FusionApiOperation.SUBMIT_ESS;

    if (operationName === FUSION_ERP_OPERATIONS.DOWNLOAD_ESS_JOB_EXECUTION_DETAILS) {
      return FusionApiOperation.DOWNLOAD_ESS_LOG;
    }

    return FusionApiOperation.OTHER;
  }

  if (
    httpMethod === 'GET' &&
    basePath === FUSION_RESOURCES.ERP_INTEGRATIONS &&
    pathWithQuery.includes(FUSION_FINDERS.ESS_JOB_STATUS)
  ) {
    return FusionApiOperation.GET_ESS_STATUS;
  }

  if (httpMethod === 'GET' && basePath.startsWith(FUSION_RESOURCES.JOURNAL_BATCHES)) {
    return FusionApiOperation.GET_JOURNAL_BATCH;
  }

  if (httpMethod === 'DELETE' && basePath.startsWith(FUSION_RESOURCES.JOURNAL_BATCHES)) {
    return FusionApiOperation.DELETE_JOURNAL_BATCH;
  }

  return FusionApiOperation.OTHER;
}

function firstListItem(body: Record<string, unknown>): Record<string, unknown> | null {
  const items = body['items'];

  if (!Array.isArray(items) || items.length === 0) return null;

  const first = items[0];

  return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
}

/**
 * 由成功回應中擷取指定鍵的參照 id（頂層或 `items[0]`），供觀測紀錄關聯使用。
 * 只取呼叫端指定的鍵，不擷取任何大型／機密欄位；全部落空時回傳 `undefined`。
 */
export function extractFusionRefs(
  body: unknown,
  refKeys: readonly string[] = DEFAULT_RESPONSE_REF_KEYS,
): Readonly<Record<string, string>> | undefined {
  if (!body || typeof body !== 'object' || refKeys.length === 0) return undefined;

  const obj = body as Record<string, unknown>;
  const first = firstListItem(obj);
  const refs: Record<string, string> = {};

  for (const key of refKeys) {
    const raw = obj[key] ?? first?.[key] ?? null;

    if (raw != null) refs[key] = String(raw);
  }

  return Object.keys(refs).length > 0 ? refs : undefined;
}

/**
 * 建立 redacted 回應摘要：僅白名單欄位，嚴禁納入 `DocumentContent`（base64）、token、
 * 或完整 payload。查無白名單欄位時回傳 `null`。
 */
export function buildResponseSummary(
  body: unknown,
  whitelistKeys: readonly string[] = DEFAULT_RESPONSE_SUMMARY_KEYS,
  maxLength: number = DEFAULT_MAX_TEXT_LENGTH,
): string | null {
  if (!body || typeof body !== 'object') return null;

  const obj = body as Record<string, unknown>;
  const summary: Record<string, unknown> = {};

  for (const key of whitelistKeys) {
    if (key in obj) summary[key] = obj[key];
  }

  const items = obj['items'];

  if (Array.isArray(items)) {
    summary['itemsCount'] = items.length;

    const first = firstListItem(obj);

    if (first) {
      const firstSummary: Record<string, unknown> = {};

      for (const key of whitelistKeys) {
        if (key in first) firstSummary[key] = first[key];
      }

      if (Object.keys(firstSummary).length > 0) summary['firstItem'] = firstSummary;
    }
  }

  if (Object.keys(summary).length === 0) return null;

  return truncate(JSON.stringify(summary), maxLength);
}

/**
 * Extracts Oracle's error code from an error body.
 *
 * Fusion follows an RFC 7807-style shape where the real cause sits in a nested `o:errorDetails`
 * array rather than at the top level:
 *
 * ```json
 * { "title": "Bad Request", "status": "400",
 *   "o:errorDetails": [{ "detail": "Unable to parse the provided payload", "o:errorCode": "27521" }] }
 * ```
 *
 * Some resources do put `o:errorCode` at the top level, so both are checked, outermost first.
 * Codes may be numeric strings (`27521`) or symbolic (`GL-782245`), so they are treated as opaque.
 */
function extractFusionErrorCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;

  const obj = body as Record<string, unknown>;
  const code = obj['o:errorCode'];

  if (typeof code === 'string') return code;

  if (typeof code === 'number') return String(code);

  const details = obj['o:errorDetails'];

  if (Array.isArray(details)) {
    for (const detail of details) {
      const nested = extractFusionErrorCode(detail);

      if (nested) return nested;
    }
  }

  return null;
}

export interface ClassifiedOutcome {
  readonly outcome: FusionApiOutcome;
  readonly httpStatus: number | null;
  readonly errorCode: string | null;
  readonly errorMessage: string;
}

/** 依錯誤三分類 + 未分類例外，決定落地的 outcome／httpStatus／errorCode／errorMessage。 */
export function classifyOutcome(error: unknown, maxTextLength: number = DEFAULT_MAX_TEXT_LENGTH): ClassifiedOutcome {
  if (error instanceof FusionAuthError) {
    return {
      outcome: FusionApiOutcome.AUTH_ERROR,
      httpStatus: error.status,
      errorCode: 'FusionAuthError',
      errorMessage: truncate(error.message, maxTextLength),
    };
  }

  // 必須排在 FusionValidationError 之前：FusionSoapFaultError 繼承自它，且帶有更精確的錯誤碼。
  if (error instanceof FusionSoapFaultError) {
    return {
      outcome: FusionApiOutcome.VALIDATION_ERROR,
      httpStatus: error.status,
      errorCode: error.errorCode ?? error.faultCode ?? 'FusionSoapFaultError',
      errorMessage: truncate(error.message, maxTextLength),
    };
  }

  if (error instanceof FusionValidationError) {
    return {
      outcome: FusionApiOutcome.VALIDATION_ERROR,
      httpStatus: error.status,
      errorCode: extractFusionErrorCode(error.body) ?? 'FusionValidationError',
      errorMessage: truncate(error.message, maxTextLength),
    };
  }

  if (error instanceof FusionTransientError) {
    return {
      outcome: FusionApiOutcome.TRANSIENT_ERROR,
      httpStatus: error.status,
      errorCode: 'FusionTransientError',
      errorMessage: truncate(error.message, maxTextLength),
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : 'UnknownError';

  return {
    outcome: FusionApiOutcome.UNKNOWN_ERROR,
    httpStatus: null,
    errorCode: name,
    errorMessage: truncate(message, maxTextLength),
  };
}
