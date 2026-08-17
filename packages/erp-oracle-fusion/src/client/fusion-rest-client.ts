import { FusionAuthProvider } from '../auth/fusion-auth-provider';
import { buildResponseSummary, deriveOperation, extractFusionRefs, redactEndpoint } from '../call-log/call-log-helpers';
import { classifyFusionHttpError } from '../errors/fusion-errors';
import { FusionHttpTransport } from '../transport/fusion-http-transport';
import type { FusionCallContext } from '../typings/call-log';
import type { FusionClientOptions, ResolvedFusionClientOptions } from '../typings/client-options';
import { resolveFusionClientOptions } from './resolve-options';

export { parseRetryAfter } from '../transport/fusion-http-transport';

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
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly pathWithQuery: string;
  readonly body?: unknown;
  /** 是否允許對 `FusionTransientError` 自動重試（只有冪等 method 為 true）。 */
  readonly retryable: boolean;
  readonly options?: FusionRequestOptions;
  /** 是否允許空 body 回應（DELETE 慣例回 204）。 */
  readonly allowEmptyBody?: boolean;
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
 * `@rytass/erp-oracle-fusion-nestjs`。SOAP 端點（如 CustomerAccountService）請用
 * `FusionSoapClient`——兩者共用同一組認證與觀測設定。
 */
export class FusionRestClient {
  private readonly options: ResolvedFusionClientOptions;
  private readonly auth: FusionAuthProvider;
  private readonly transport: FusionHttpTransport;

  constructor(options: FusionClientOptions) {
    this.options = resolveFusionClientOptions(options);
    this.auth = new FusionAuthProvider(this.options);
    this.transport = new FusionHttpTransport(this.options, this.auth);
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

  private async parseBody<T>(response: Response, allowEmptyBody: boolean): Promise<T> {
    if (!allowEmptyBody) {
      return (await response.json()) as T;
    }

    const bodyText = await response.text();

    return (bodyText ? JSON.parse(bodyText) : null) as T;
  }

  /** 組出傳輸層請求並交由 `FusionHttpTransport` 執行。 */
  private async execute<T>(spec: ExecuteSpec): Promise<T> {
    const { method, pathWithQuery, body, retryable, options, allowEmptyBody } = spec;

    const resolveOperation = this.options.operationResolver ?? deriveOperation;
    const frameworkVersion = options?.restFrameworkVersion ?? this.options.restFrameworkVersion;

    return this.transport.execute<T>({
      method,
      url: this.resourceUrl(pathWithQuery, options),
      headers: {
        // The Oracle error media type is required for structured `o:errorDetails` responses;
        // without it Fusion may return an unstructured error body.
        Accept: 'application/json, application/vnd.oracle.adf.error+json',
        ...(frameworkVersion !== null && frameworkVersion !== undefined
          ? { 'REST-Framework-Version': String(frameworkVersion) }
          : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/vnd.oracle.adf.resourceitem+json' } : {}),
        ...(options?.headers ?? {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      description: `${method} ${pathWithQuery}`,
      operation: resolveOperation(method, pathWithQuery, body),
      endpoint: redactEndpoint(pathWithQuery),
      ...(options?.context ? { context: options.context } : {}),
      maxRetries: retryable ? (options?.maxRetries ?? this.options.maxRetries) : 0,
      classifyError: classifyFusionHttpError,
      parseResponse: (response: Response) => this.parseBody<T>(response, allowEmptyBody === true),
      extractRefs: (result: T) => extractFusionRefs(result, this.options.responseRefKeys),
      buildSummary: (result: T) =>
        buildResponseSummary(result, this.options.responseSummaryKeys, this.options.maxTextLength),
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
