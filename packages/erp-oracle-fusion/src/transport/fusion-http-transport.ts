import { FusionAuthProvider } from '../auth/fusion-auth-provider';
import { classifyOutcome } from '../call-log/call-log-helpers';
import { FusionTransientError, isFusionRequestError, wrapNetworkError } from '../errors/fusion-errors';
import type { FusionRequestError } from '../errors/fusion-errors';
import { FusionApiOutcome } from '../typings/call-log';
import type { FusionCallContext, FusionCallLogEntry, FusionHttpMethod, FusionOperation } from '../typings/call-log';
import type { ResolvedFusionClientOptions } from '../typings/client-options';

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
export function backoffWithJitter(baseDelayMs: number, attempt: number): number {
  const window = baseDelayMs * 2 ** (attempt - 1);

  return window === 0 ? 0 : Math.round(window / 2 + Math.random() * (window / 2));
}

/**
 * 一次傳輸層請求的完整規格。序列化、錯誤分類、回應解析都由呼叫端以 hook 提供——這是 REST
 * 與 SOAP 唯一的差異點，其餘（認證、逾時、重試、埋點）由 transport 統一處理。
 */
export interface FusionTransportRequest<T> {
  readonly method: FusionHttpMethod;
  /** 完整請求 URL（呼叫端自行組出，transport 不介入路徑規則）。 */
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  /** 已序列化的請求 body；`undefined` 代表無 body。 */
  readonly body?: string;
  /** 錯誤訊息與重試 log 用的人類可讀描述。 */
  readonly description: string;
  /** 觀測紀錄的操作分類。 */
  readonly operation: FusionOperation;
  /** 觀測紀錄的 endpoint（呼叫端負責 redact query string）。 */
  readonly endpoint: string;
  readonly context?: FusionCallContext;
  /** 最大重試次數；0 代表不重試（非冪等操作應恆為 0）。 */
  readonly maxRetries: number;
  /** 非 2xx 回應如何分類為 Fusion 錯誤。 */
  readonly classifyError: (status: number, bodyText: string, description: string) => FusionRequestError;
  /** 2xx 回應如何解析為結果。 */
  readonly parseResponse: (response: Response) => Promise<T>;
  /**
   * 解析成功後的二次檢查：HTTP 狀態正常但 payload 內含錯誤時（SOAP fault 即屬此類），
   * 回傳要拋出的錯誤；回傳 `null` 代表確實成功。第三個參數是實際的 HTTP 狀態碼，
   * 供錯誤物件如實記錄。
   */
  readonly inspectResult?: (result: T, description: string, status: number) => FusionRequestError | null;
  /** 觀測紀錄：從結果擷取參照 id。 */
  readonly extractRefs?: (result: T) => Readonly<Record<string, string>> | undefined;
  /** 觀測紀錄：從結果建立 redacted 摘要。 */
  readonly buildSummary?: (result: T) => string | null;
}

/**
 * Fusion 呼叫的共用 HTTP 傳輸層——認證、逾時、重試、觀測埋點的單一實作。
 *
 * `FusionRestClient` 與 `FusionSoapClient` 都建構在此之上：兩者只在序列化格式與錯誤分類
 * 上不同，重試與埋點的行為必須一致，因此刻意集中在這裡而非各自複製。
 *
 * 設計原則：
 * - **冪等才重試**：是否可重試由呼叫端以 `maxRetries` 表達，transport 不自行判斷語意。
 * - **觀測不影響業務**：每次呼叫（成功與最終失敗）落一筆 `FusionCallLogEntry`；埋點失敗
 *   只記 warn，絕不改變原呼叫的回傳或拋錯行為。
 */
export class FusionHttpTransport {
  constructor(
    private readonly options: ResolvedFusionClientOptions,
    private readonly auth: FusionAuthProvider,
  ) {}

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

  private async logFailure(
    error: unknown,
    meta: {
      readonly operation: FusionOperation;
      readonly method: FusionHttpMethod;
      readonly endpoint: string;
      readonly context?: FusionCallContext;
      readonly startedAt: number;
      readonly attempt: number;
    },
  ): Promise<void> {
    const classified = classifyOutcome(error, this.options.maxTextLength);

    await this.logCallSafely({
      operation: meta.operation,
      httpMethod: meta.method,
      endpoint: meta.endpoint,
      correlationType: meta.context?.correlationType,
      correlationId: meta.context?.correlationId,
      httpStatus: classified.httpStatus,
      outcome: classified.outcome,
      errorCode: classified.errorCode,
      errorMessage: classified.errorMessage,
      latencyMs: Date.now() - meta.startedAt,
      attempt: meta.attempt + 1,
    });
  }

  /** 統一的請求執行：認證 → 送出 → 分類 → （必要時）重試 → 埋點。 */
  async execute<T>(request: FusionTransportRequest<T>): Promise<T> {
    const { method, url, description, operation, endpoint, context, maxRetries } = request;
    const startedAt = Date.now();

    const authorization = await this.auth.getAuthorizationHeader();

    const headers: Record<string, string> = {
      Authorization: authorization,
      ...request.headers,
    };

    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    let attempt = 0;

    for (;;) {
      try {
        const response = await fetchImpl(url, {
          method,
          headers,
          ...(this.options.timeoutMs > 0 ? { signal: AbortSignal.timeout(this.options.timeoutMs) } : {}),
          ...(request.body !== undefined ? { body: request.body } : {}),
        });

        if (!response.ok) {
          const bodyText = await response.text();
          const error = request.classifyError(response.status, bodyText, description);

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

        const result = await request.parseResponse(response);
        const payloadError = request.inspectResult?.(result, description, response.status) ?? null;

        if (payloadError) {
          // SOAP fault 走這條路：HTTP 狀態不足以判斷成敗，分類完再套用同一套重試規則。
          if (payloadError instanceof FusionTransientError && attempt < maxRetries) {
            attempt += 1;

            const delayMs = backoffWithJitter(this.options.retryBaseDelayMs, attempt);

            this.options.logger?.warn(
              `Fusion ${description} transient error, retry ${attempt}/${maxRetries} in ${delayMs}ms`,
            );

            await delay(delayMs);

            continue;
          }

          throw payloadError;
        }

        await this.logCallSafely({
          operation,
          httpMethod: method,
          endpoint,
          correlationType: context?.correlationType,
          correlationId: context?.correlationId,
          refs: request.extractRefs?.(result),
          httpStatus: response.status,
          outcome: FusionApiOutcome.SUCCESS,
          latencyMs: Date.now() - startedAt,
          attempt: attempt + 1,
          responseSummary: request.buildSummary?.(result) ?? null,
        });

        return result;
      } catch (error) {
        // 已分類的 Fusion 錯誤：重試決策在上面做完了，走到這裡代表確定失敗。
        if (isFusionRequestError(error)) {
          await this.logFailure(error, { operation, method, endpoint, context, startedAt, attempt });

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

        await this.logFailure(wrapped, { operation, method, endpoint, context, startedAt, attempt });

        throw wrapped;
      }
    }
  }
}
