import type { FusionAuthConfig, ResolvedFusionAuthConfig } from './auth';
import type { FusionCallLogSink, FusionHttpMethod, FusionOperation } from './call-log';
import type { FusionLogger } from './logger';

/**
 * 依 HTTP method／path／body 推導觀測用的操作分類。不提供時使用內建的 Fusion ERP 規則。
 * 可回傳任意字串，非 GL 模組的使用者不受內建 enum 限制。
 */
export type FusionOperationResolver = (
  httpMethod: FusionHttpMethod,
  pathWithQuery: string,
  body?: unknown,
) => FusionOperation;

/**
 * `FusionRestClient` 的設定。除 `baseUrl` 與 `auth` 外全部選填，未填時採用 Fusion ERP 的
 * 通用預設值（`fscmRestApi` / `11.13.18.05` / 3 次重試 / 500ms 退避基數 / 每頁 500 筆 / 60 秒逾時）。
 */
export interface FusionClientOptions {
  /** Fusion pod 根位址，如 `https://xxx.fa.ap1.oraclecloud.com`。尾端斜線會自動去除。 */
  readonly baseUrl: string;
  readonly auth: FusionAuthConfig;
  /** REST 命名空間，預設 `fscmRestApi`；CRM／HCM 資源可傳 `crmRestApi`／`hcmRestApi`。 */
  readonly defaultNamespace?: string;
  /** REST 版本區段，預設 `11.13.18.05`。 */
  readonly defaultApiVersion?: string;
  /**
   * `REST-Framework-Version` header (1-9). Fusion defaults to **version 1** when the header is
   * absent, which is the oldest behaviour: child collections are not paginated under `expand`
   * and `fields` until version 3, and payload shapes for list-valued attributes differ between
   * versions (comma-separated up to 7, arrays from 8). Pinning a version is strongly recommended
   * so a pod upgrade cannot change how your payloads are interpreted.
   *
   * Not sent when omitted, preserving whatever the pod defaults to.
   */
  readonly restFrameworkVersion?: number;
  /** 冪等 GET 的最大重試次數，預設 3。 */
  readonly maxRetries?: number;
  /** 重試退避基數（毫秒），第 n 次退避 `base * 2^(n-1)`，預設 500。 */
  readonly retryBaseDelayMs?: number;
  /** `getAll()` 的預設每頁筆數，預設 500。 */
  readonly defaultPageSize?: number;
  /**
   * 單次請求逾時（毫秒），預設 60000。逾時視為可重試的暫時性錯誤。
   * 設為 0 代表不設逾時（沿用 runtime 預設，Node／undici 為 300 秒）。
   */
  readonly timeoutMs?: number;
  /**
   * 覆寫底層 fetch 實作，預設 `globalThis.fetch`。用於掛載企業 proxy／client cert
   * （如 undici `ProxyAgent`／`Agent` 包一層），或在測試中替換。
   */
  readonly fetchImpl?: typeof fetch;
  /** 觀測紀錄的操作分類器，預設使用內建 Fusion ERP 規則。 */
  readonly operationResolver?: FusionOperationResolver;
  /**
   * 要從回應中擷取到 `FusionCallLogEntry.refs` 的欄位名，預設 `ReqstId`／`JeBatchId`
   * （`erpintegrations` 情境）。其他模組可改成自己的參照鍵。
   */
  readonly responseRefKeys?: readonly string[];
  /**
   * `responseSummary` 的白名單欄位。**務必只放非機密的小欄位**——摘要會原樣落到觀測儲存。
   */
  readonly responseSummaryKeys?: readonly string[];
  /** 單筆錯誤訊息／摘要的截斷長度，預設 2000。 */
  readonly maxTextLength?: number;
  /** 觀測紀錄落地目的地，未提供時不落地。 */
  readonly callLogSink?: FusionCallLogSink;
  /** 記錄器，未提供時完全不輸出訊息。 */
  readonly logger?: FusionLogger;
}

/** 內部使用：所有選填欄位都已套上預設值的設定。 */
export interface ResolvedFusionClientOptions {
  readonly baseUrl: string;
  readonly auth: ResolvedFusionAuthConfig;
  readonly defaultNamespace: string;
  readonly defaultApiVersion: string;
  readonly restFrameworkVersion: number | null;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  readonly defaultPageSize: number;
  readonly timeoutMs: number;
  readonly fetchImpl: typeof fetch | null;
  readonly operationResolver: FusionOperationResolver | null;
  readonly responseRefKeys: readonly string[];
  readonly responseSummaryKeys: readonly string[];
  readonly maxTextLength: number;
  readonly callLogSink: FusionCallLogSink | null;
  readonly logger: FusionLogger | null;
}
