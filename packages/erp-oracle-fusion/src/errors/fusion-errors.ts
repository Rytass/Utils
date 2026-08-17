/**
 * Fusion REST 呼叫錯誤三分類——分類的用途是驅動「可否重試」的決策，而非只是包裝訊息。
 *
 * - `FusionAuthError`（401／403）：認證／授權失敗，不可重試（token 過期以外多半是 run-as
 *   user 角色不足），需人工排查。
 * - `FusionValidationError`（400）：請求本身有誤（段值不存在、格式錯誤等），保留 Fusion
 *   回傳的錯誤 body 供除錯，不可重試。
 * - `FusionTransientError`（429／5xx／網路錯誤／逾時／404）：暫時性失敗，冪等 GET 由 client
 *   內建指數退避重試；寫入類不自動重試，由呼叫端決定 retry 或 dead-letter。
 */
export class FusionAuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'FusionAuthError';
    this.status = status;
  }
}

export class FusionValidationError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'FusionValidationError';
    this.status = status;
    this.body = body;
  }
}

export class FusionTransientError extends Error {
  /** null 代表網路層錯誤或逾時（無 HTTP status）。 */
  readonly status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = 'FusionTransientError';
    this.status = status;
  }
}

/** SOAP fault 的欄位級錯誤（`ServiceAttrValErrorMessage`），供資料修正時定位問題欄位。 */
export interface FusionSoapAttributeError {
  readonly attributeName: string | null;
  readonly objectName: string | null;
  readonly message: string | null;
}

/**
 * Fusion SOAP fault。
 *
 * **刻意繼承 `FusionValidationError`**，理由是「可否重試」的決策：SOAP fault 一律以
 * HTTP 500 回傳，若沿用 REST 的 status 分類會被判為 `FusionTransientError` 而自動重試——
 * 對 `createCustomerAccount` 這類非冪等寫入是危險的。繼承驗證錯誤讓它天然屬於
 * `FusionRequestError`（`isFusionRequestError` 為 true）且不可重試。
 */
export class FusionSoapFaultError extends FusionValidationError {
  /** SOAP 層的 `faultcode`，如 `env:Server`／`env:Client`。 */
  readonly faultCode: string | null;
  /** Oracle 應用層錯誤碼，如 `FND:::FND_CMN_RCRD_MSNG`。 */
  readonly errorCode: string | null;
  readonly severity: string | null;
  readonly exceptionClassName: string | null;
  /** 遞迴 `detail` 中所有欄位級錯誤，順序為 Fusion 回傳順序。 */
  readonly attributeErrors: readonly FusionSoapAttributeError[];

  constructor(
    status: number,
    message: string,
    body: unknown,
    details: {
      readonly faultCode?: string | null;
      readonly errorCode?: string | null;
      readonly severity?: string | null;
      readonly exceptionClassName?: string | null;
      readonly attributeErrors?: readonly FusionSoapAttributeError[];
    } = {},
  ) {
    super(status, message, body);
    this.name = 'FusionSoapFaultError';
    this.faultCode = details.faultCode ?? null;
    this.errorCode = details.errorCode ?? null;
    this.severity = details.severity ?? null;
    this.exceptionClassName = details.exceptionClassName ?? null;
    this.attributeErrors = details.attributeErrors ?? [];
  }
}

export type FusionRequestError = FusionAuthError | FusionValidationError | FusionTransientError;

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** 依 HTTP status 分類非 2xx 回應為三類錯誤之一。 */
export function classifyFusionHttpError(status: number, bodyText: string, pathDescription: string): FusionRequestError {
  if (status === 401 || status === 403) {
    return new FusionAuthError(
      status,
      `Fusion authentication/authorization failed (${pathDescription}): ${status} ${bodyText}`,
    );
  }

  if (status === 400) {
    return new FusionValidationError(
      status,
      `Fusion request validation failed (${pathDescription}): ${status} ${bodyText}`,
      tryParseJson(bodyText),
    );
  }

  return new FusionTransientError(status, `Fusion transient error (${pathDescription}): ${status} ${bodyText}`);
}

/** 將非 Fusion 錯誤（fetch 網路層 throw、AbortSignal 逾時）包裝為 FusionTransientError。 */
export function wrapNetworkError(error: unknown, pathDescription: string): FusionTransientError {
  const message = error instanceof Error ? error.message : String(error);

  return new FusionTransientError(null, `Fusion network error (${pathDescription}): ${message}`);
}

/** 判斷是否為本套件分類過的 Fusion 錯誤（三類之一）。 */
export function isFusionRequestError(error: unknown): error is FusionRequestError {
  return (
    error instanceof FusionAuthError || error instanceof FusionValidationError || error instanceof FusionTransientError
  );
}
