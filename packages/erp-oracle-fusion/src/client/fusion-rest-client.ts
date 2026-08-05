import { FusionAuthProvider } from '../auth/fusion-auth-provider';
import {
  buildResponseSummary,
  classifyOutcome,
  deriveOperation,
  extractFusionRefs,
  redactEndpoint,
} from '../call-log/call-log-helpers';
import {
  classifyFusionHttpError,
  FusionTransientError,
  isFusionRequestError,
  wrapNetworkError,
} from '../errors/fusion-errors';
import { FusionApiOutcome } from '../typings/call-log';
import type { FusionCallContext, FusionCallLogEntry, FusionHttpMethod, FusionOperation } from '../typings/call-log';
import type { FusionClientOptions, ResolvedFusionClientOptions } from '../typings/client-options';
import { resolveFusionClientOptions } from './resolve-options';

/**
 * Standard shape of a Fusion collection response.
 *
 * `limit` is the page size the **server** actually used, which may differ from what was requested.
 * Paging must advance by this value, not by the requested one.
 */
export interface FusionListResponse<T> {
  readonly items?: readonly T[];
  readonly hasMore?: boolean;
  readonly limit?: number;
  readonly count?: number;
  readonly offset?: number;
}

export interface FusionRequestOptions {
  /** 最大重試次數（僅冪等 GET 適用），未指定時採用建構時的設定值。 */
  readonly maxRetries?: number;
  /** Overrides the `REST-Framework-Version` header for this call. */
  readonly restFrameworkVersion?: number;
  /** 關聯業務物件，落地到觀測紀錄；不傳則不帶關聯。 */
  readonly context?: FusionCallContext;
  /** 覆寫 REST 命名空間（如 `crmRestApi`），未指定時採用建構時的設定值。 */
  readonly namespace?: string;
  /** 覆寫 REST 版本區段。 */
  readonly apiVersion?: string;
  /** 附加／覆寫 HTTP 標頭（如 `Metadata-Context`、`REST-Framework-Version`）。 */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * 寫入類（`post`／`patch`／`delete`）的選項——刻意排除 `maxRetries`：這些 method 一律不
 * 自動重試，型別上分離可讓誤用在編譯期就被擋下。
 */
export type FusionWriteOptions = Omit<FusionRequestOptions, 'maxRetries'>;

interface ExecuteSpec {
  readonly method: FusionHttpMethod;
  readonly pathWithQuery: string;
  readonly body?: unknown;
  /** 是否允許對 `FusionTransientError` 自動重試（只有冪等 method 為 true）。 */
  readonly retryable: boolean;
  readonly options?: FusionRequestOptions;
  /** 是否允許空 body 回應（DELETE 慣例回 204）。 */
  readonly allowEmptyBody?: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parses a `Retry-After` header, which Fusion sends on 429 and some 503 responses.
 * Accepts both delay-seconds and an HTTP date; returns null when absent or unparsable.
 */
export function parseRetryAfter(headerValue: string | null, now: number = Date.now()): number | null {
  if (!headerValue) return null;

  const seconds = Number(headerValue);

  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(headerValue);

  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/**
 * Full jitter on top of exponential backoff. Without it, every client that failed on the same
 * upstream blip retries in lockstep and re-creates the spike.
 */
function backoffWithJitter(baseDelayMs: number, attempt: number): number {
  const window = baseDelayMs * 2 ** (attempt - 1);

  return window === 0 ? 0 : Math.round(window / 2 + Math.random() * (window / 2));
}

/**
 * Oracle Fusion REST client——認證、重試、錯誤分類、觀測埋點的單一入口。
 *
 * 設計原則：
 * - **冪等才重試**：`get`／`getAll` 對 `FusionTransientError`（429／5xx／網路錯誤／逾時）
 *   指數退避重試；`post`／`patch`／`delete` **一律不自動重試**，避免非冪等寫入重複送出，
 *   失敗直接拋出分類後的錯誤，由呼叫端決定 retry／dead-letter／降級。
 * - **觀測不影響業務**：每次呼叫（成功與最終失敗）落一筆 `FusionCallLogEntry` 到
 *   `callLogSink`；埋點包在 try/catch 內，失敗只記 warn，絕不改變原呼叫的回傳或拋錯行為。
 * - **路徑不寫死**：命名空間與 API 版本可全域設定或單次覆寫；path 以 `/` 開頭時視為 pod
 *   絕對路徑，以 `http(s)://` 開頭時原樣使用。
 *
 * 本類別不依賴任何框架，可直接 `new` 使用；NestJS 專案請改用
 * `@rytass/erp-oracle-fusion-nestjs`。
 */
export class FusionRestClient {
  private readonly options: ResolvedFusionClientOptions;
  private readonly auth: FusionAuthProvider;

  constructor(options: FusionClientOptions) {
    this.options = resolveFusionClientOptions(options);
    this.auth = new FusionAuthProvider(this.options);
  }

  /** 授權標頭供應者（供診斷、或需要自行發請求時取用）。 */
  get authProvider(): FusionAuthProvider {
    return this.auth;
  }

  /**
   * 組出完整請求 URL。
   * - `https://…`：原樣使用
   * - `/…`：pod 絕對路徑（`{baseUrl}{path}`），供非標準命名空間的端點使用
   * - 其他：`{baseUrl}/{namespace}/resources/{apiVersion}/{path}`
   */
  resourceUrl(pathWithQuery: string, options?: FusionRequestOptions): string {
    if (/^https?:\/\//i.test(pathWithQuery)) {
      return pathWithQuery;
    }

    const baseUrl = this.options.baseUrl;

    if (pathWithQuery.startsWith('/')) {
      return `${baseUrl}${pathWithQuery}`;
    }

    const namespace = options?.namespace ?? this.options.defaultNamespace;
    const apiVersion = options?.apiVersion ?? this.options.defaultApiVersion;

    return `${baseUrl}/${namespace}/resources/${apiVersion}/${pathWithQuery}`;
  }

  /** 埋點寫入包一層防守（sink 契約已要求不拋出，此處為雙重保險）。 */
  private async logCallSafely(entry: FusionCallLogEntry): Promise<void> {
    if (!this.options.callLogSink) return;

    try {
      await this.options.callLogSink.record(entry);
    } catch (error) {
      this.options.logger?.warn(
        `Fusion call log sink failed (original call unaffected): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** 統一的請求執行：認證 → 送出 → 分類 → （必要時）重試 → 埋點。 */
  private async execute<T>(spec: ExecuteSpec): Promise<T> {
    const { method, pathWithQuery, body, retryable, options, allowEmptyBody } = spec;

    const startedAt = Date.now();
    const resolveOperation = this.options.operationResolver ?? deriveOperation;
    const operation = resolveOperation(method, pathWithQuery, body);
    const endpoint = redactEndpoint(pathWithQuery);
    const maxRetries = retryable ? (options?.maxRetries ?? this.options.maxRetries) : 0;
    const description = `${method} ${pathWithQuery}`;

    const authorization = await this.auth.getAuthorizationHeader();
    const url = this.resourceUrl(pathWithQuery, options);

    const frameworkVersion = options?.restFrameworkVersion ?? this.options.restFrameworkVersion;

    const headers: Record<string, string> = {
      Authorization: authorization,
      // The Oracle error media type is required for structured `o:errorDetails` responses;
      // without it Fusion may return an unstructured error body.
      Accept: 'application/json, application/vnd.oracle.adf.error+json',
      ...(frameworkVersion !== null && frameworkVersion !== undefined
        ? { 'REST-Framework-Version': String(frameworkVersion) }
        : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/vnd.oracle.adf.resourceitem+json' } : {}),
      ...(options?.headers ?? {}),
    };

    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    let attempt = 0;

    for (;;) {
      try {
        const response = await fetchImpl(url, {
          method,
          headers,
          ...(this.options.timeoutMs > 0 ? { signal: AbortSignal.timeout(this.options.timeoutMs) } : {}),
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });

        if (!response.ok) {
          const bodyText = await response.text();
          const error = classifyFusionHttpError(response.status, bodyText, description);

          if (error instanceof FusionTransientError && attempt < maxRetries) {
            attempt += 1;

            // Honour Retry-After when the server states one; otherwise back off with jitter.
            const retryAfterMs = parseRetryAfter(response.headers?.get?.('retry-after') ?? null);
            const delayMs = retryAfterMs ?? backoffWithJitter(this.options.retryBaseDelayMs, attempt);

            this.options.logger?.warn(
              `Fusion ${description} transient error, retry ${attempt}/${maxRetries} in ${delayMs}ms`,
            );

            await delay(delayMs);

            continue;
          }

          throw error;
        }

        const json = await this.parseBody<T>(response, allowEmptyBody === true);

        await this.logCallSafely({
          operation,
          httpMethod: method,
          endpoint,
          correlationType: options?.context?.correlationType,
          correlationId: options?.context?.correlationId,
          refs: extractFusionRefs(json, this.options.responseRefKeys),
          httpStatus: response.status,
          outcome: FusionApiOutcome.SUCCESS,
          latencyMs: Date.now() - startedAt,
          attempt: attempt + 1,
          responseSummary: buildResponseSummary(json, this.options.responseSummaryKeys, this.options.maxTextLength),
        });

        return json;
      } catch (error) {
        // 已分類的 Fusion 錯誤：重試決策在上面做完了，走到這裡代表確定失敗。
        if (isFusionRequestError(error)) {
          await this.logFailure(error, { operation, method, endpoint, options, startedAt, attempt });

          throw error;
        }

        // fetch 網路層錯誤（DNS／連線失敗）或 AbortSignal 逾時
        if (attempt < maxRetries) {
          attempt += 1;
          this.options.logger?.warn(`Fusion ${description} network error, retry ${attempt}/${maxRetries}`);
          await delay(backoffWithJitter(this.options.retryBaseDelayMs, attempt));

          continue;
        }

        const wrapped = wrapNetworkError(error, description);

        await this.logFailure(wrapped, { operation, method, endpoint, options, startedAt, attempt });

        throw wrapped;
      }
    }
  }

  private async parseBody<T>(response: Response, allowEmptyBody: boolean): Promise<T> {
    if (!allowEmptyBody) {
      return (await response.json()) as T;
    }

    const bodyText = await response.text();

    return (bodyText ? JSON.parse(bodyText) : null) as T;
  }

  private async logFailure(
    error: unknown,
    meta: {
      readonly operation: FusionOperation;
      readonly method: FusionHttpMethod;
      readonly endpoint: string;
      readonly options?: FusionRequestOptions;
      readonly startedAt: number;
      readonly attempt: number;
    },
  ): Promise<void> {
    const classified = classifyOutcome(error, this.options.maxTextLength);

    await this.logCallSafely({
      operation: meta.operation,
      httpMethod: meta.method,
      endpoint: meta.endpoint,
      correlationType: meta.options?.context?.correlationType,
      correlationId: meta.options?.context?.correlationId,
      httpStatus: classified.httpStatus,
      outcome: classified.outcome,
      errorCode: classified.errorCode,
      errorMessage: classified.errorMessage,
      latencyMs: Date.now() - meta.startedAt,
      attempt: meta.attempt + 1,
    });
  }

  /** 冪等 GET，429／5xx／網路錯誤／逾時指數退避重試。 */
  async get<T>(pathWithQuery: string, options?: FusionRequestOptions): Promise<T> {
    return this.execute<T>({ method: 'GET', pathWithQuery, retryable: true, options });
  }

  /**
   * 分頁抓取整個集合（offset／limit，靠回應 `hasMore` 續抓）。
   * `path` 可自帶 query string，會自動以 `&`／`?` 接續分頁參數。
   * 內部逐頁呼叫 `get()`，每頁各自落一筆觀測紀錄。
   */
  async getAll<T>(path: string, pageSize?: number, options?: FusionRequestOptions): Promise<T[]> {
    const requestedLimit = pageSize ?? this.options.defaultPageSize;
    const separator = path.includes('?') ? '&' : '?';
    const all: T[] = [];
    let offset = 0;

    for (;;) {
      const page = await this.get<FusionListResponse<T>>(
        `${path}${separator}limit=${requestedLimit}&offset=${offset}`,
        options,
      );

      const items = page.items ?? [];

      all.push(...items);

      if (items.length === 0) break;

      // The server may cap the page size; advancing by the requested limit would skip rows.
      const serverLimit = typeof page.limit === 'number' && page.limit > 0 ? page.limit : requestedLimit;

      if (serverLimit !== requestedLimit) {
        this.options.logger?.debug?.(
          `Fusion GET ${path} server page size is ${serverLimit} (requested ${requestedLimit}); advancing by the server value`,
        );
      }

      offset += Math.min(serverLimit, items.length) || serverLimit;

      if (page.hasMore === undefined) {
        // Non-standard collections omit hasMore: infer from a full page rather than truncating.
        if (items.length < serverLimit) break;

        this.options.logger?.warn(
          `Fusion GET ${path} response has no hasMore flag; falling back to page fullness for pagination`,
        );

        continue;
      }

      if (!page.hasMore) break;
    }

    return all;
  }

  /** 非冪等 POST，不自動重試；失敗直接拋出分類後的錯誤。 */
  async post<T>(pathWithQuery: string, body: unknown, options?: FusionWriteOptions): Promise<T> {
    return this.execute<T>({ method: 'POST', pathWithQuery, body, retryable: false, options });
  }

  /** 非冪等 PATCH（Fusion 更新資源的標準 method），不自動重試。 */
  async patch<T>(pathWithQuery: string, body: unknown, options?: FusionWriteOptions): Promise<T> {
    return this.execute<T>({ method: 'PATCH', pathWithQuery, body, retryable: false, options });
  }

  /**
   * 非冪等 DELETE，不自動重試。成功回應允許 `204 No Content` 或空 body（此時回傳 `null`）。
   *
   * 呼叫端**應**自行 try/catch：Fusion 常因整合帳號權限不足而拒絕刪除，這類失敗通常應降級
   * 為「待人工清理」而非讓整個業務操作失敗。
   */
  async delete<T = unknown>(pathWithQuery: string, options?: FusionWriteOptions): Promise<T | null> {
    return this.execute<T | null>({
      method: 'DELETE',
      pathWithQuery,
      retryable: false,
      options,
      allowEmptyBody: true,
    });
  }
}
