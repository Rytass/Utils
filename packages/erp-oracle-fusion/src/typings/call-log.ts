/**
 * 內建的 Fusion REST 呼叫種類。依 `erpintegrations` 的 `OperationName` 或資源路徑歸類。
 *
 * 這些值偏向 `erpintegrations`／GL 情境。**其他模組（CRM／HCM／AP…）的使用者不必受限於本
 * enum**——`operation` 的型別是 `FusionOperation`（本 enum 或任意字串），可用
 * `FusionClientOptions.operationResolver` 回傳自訂分類。
 */
export enum FusionApiOperation {
  IMPORT_BULK_DATA = 'IMPORT_BULK_DATA', // erpintegrations OperationName=importBulkData（FBDI 匯入）
  SUBMIT_ESS = 'SUBMIT_ESS', // erpintegrations OperationName=submitESSJobRequest
  GET_ESS_STATUS = 'GET_ESS_STATUS', // erpintegrations?finder=ESSJobStatusRF
  DOWNLOAD_ESS_LOG = 'DOWNLOAD_ESS_LOG', // erpintegrations OperationName=downloadESSJobExecutionDetails
  GET_JOURNAL_BATCH = 'GET_JOURNAL_BATCH', // GET journalBatches / journalBatches/{id}
  DELETE_JOURNAL_BATCH = 'DELETE_JOURNAL_BATCH', // DELETE journalBatches/{id}
  OTHER = 'OTHER',
}

/** 呼叫結果分類，對應錯誤三分類 + SUCCESS／UNKNOWN_ERROR。 */
export enum FusionApiOutcome {
  SUCCESS = 'SUCCESS',
  TRANSIENT_ERROR = 'TRANSIENT_ERROR', // FusionTransientError（429/5xx/網路錯誤/逾時）
  VALIDATION_ERROR = 'VALIDATION_ERROR', // FusionValidationError（400）
  AUTH_ERROR = 'AUTH_ERROR', // FusionAuthError（401/403）
  UNKNOWN_ERROR = 'UNKNOWN_ERROR', // 未分類例外
}

/**
 * 觀測紀錄的操作分類：內建 enum 值，或消費端 `operationResolver` 回傳的任意字串。
 * 寫成聯集而非封閉 enum，是為了讓非 GL 模組的使用者也能產出有意義的分類。
 */
export type FusionOperation = FusionApiOperation | (string & Record<never, never>);

/** client 實際送出的 HTTP method。 */
export type FusionHttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * 觀測紀錄的 method 欄位：client 自身埋點恆為真實 HTTP method，但消費端也可直接呼叫 sink
 * 記錄**非 HTTP 的語意化事件**（例如週期偵測產生的 `POLL`、人工介入的 `MANUAL`），
 * 讓「一筆單據的所有整合事件」能收在同一份紀錄裡。
 */
export type FusionCallLogMethod = FusionHttpMethod | (string & Record<never, never>);

/**
 * 呼叫關聯 context：由呼叫端帶入自身業務物件的種類與 id，供日後「追一筆單據的所有 Fusion
 * 呼叫」。`correlationType` 刻意為 `string`——業務語意屬於消費端專案，本套件不預設任何一組。
 */
export interface FusionCallContext {
  readonly correlationType: string;
  readonly correlationId: string;
}

/** 一次 Fusion 呼叫（含內建重試的完整週期）的觀測紀錄。 */
export interface FusionCallLogEntry {
  readonly operation: FusionOperation;
  readonly httpMethod: FusionCallLogMethod;
  /** 已去除 query string 的 resource path。 */
  readonly endpoint: string;
  readonly correlationType?: string | null;
  readonly correlationId?: string | null;
  /**
   * 從回應中擷取的參照 id，鍵名即回應中的欄位名（如 `ReqstId`、`JeBatchId`）。
   * 要擷取哪些鍵由 `FusionClientOptions.responseRefKeys` 決定。
   */
  readonly refs?: Readonly<Record<string, string>>;
  /** 網路層錯誤或逾時時為 null（無 HTTP 回應）。 */
  readonly httpStatus: number | null;
  readonly outcome: FusionApiOutcome;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  /** 本次呼叫總耗時（毫秒，涵蓋內建重試）。 */
  readonly latencyMs: number;
  /** 內建重試後的總嘗試次數（不重試的 method 恆為 1）。 */
  readonly attempt: number;
  /** Redacted 回應摘要（僅白名單欄位），無可摘要欄位時為 null。 */
  readonly responseSummary?: string | null;
}

/**
 * 觀測埋點的落地目的地。本套件只負責「產生」紀錄，不決定「存到哪」——消費端可實作為
 * 資料表、Prometheus、OpenTelemetry、外部 log 服務或任意組合。
 *
 * **實作契約**：`record()` **不得拋出**。client 雖已包一層防守，實作端仍應自行吞掉錯誤，
 * 確保觀測性永遠不會影響業務呼叫的成敗。
 */
export interface FusionCallLogSink {
  record(entry: FusionCallLogEntry): Promise<void>;
}
