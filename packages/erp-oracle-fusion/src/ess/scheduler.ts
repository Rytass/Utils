/**
 * ESS Scheduler REST（`/ess/rest/scheduler/v1/requests`）的參數序列化與狀態語意。
 *
 * Fusion 提交 ESS job 有兩條通道，兩者的參數格式與狀態詞彙都不同，不可混用：
 *
 * | | `erpintegrations` `submitESSJobRequest` | Scheduler REST |
 * | --- | --- | --- |
 * | 參數 | 逗號串接的位置字串 | `submit.argumentN` 具名陣列 |
 * | 狀態查詢 | `ESSJobStatusRF`（只查得到自己這條通道送出的） | `requests/{id}`（兩條通道送出的都查得到） |
 * | 狀態詞彙 | `RequestStatus`（見 `classifyEssStatus`） | `state`（見 `classifySchedulerState`） |
 *
 * 並非每個 job 兩條通道都收：Receivables 的票據、匯款、結清類 job 只在 Scheduler REST 上驗證過。
 */

/** Scheduler REST 的請求集合路徑（pod 絕對路徑，不在 `fscmRestApi` 命名空間下）。 */
export const FUSION_ESS_SCHEDULER_REQUESTS_PATH = '/ess/rest/scheduler/v1/requests';

/** Financials／SCM job 所屬的 ESS 應用程式。 */
export const FUSION_ESS_DEFAULT_APPLICATION = 'FscmEss';

/**
 * ESS 位置參數：key 為 **1-based** 位置，與 Scheduled Processes UI「所有參數值」的
 * argument1..N 對齊。
 *
 * 用 Map 而非陣列：ESS 對位置錯一格不會報錯，只會靜默選不到資料；明寫位置比數逗號可靠。
 */
export type EssPositionalArguments = ReadonlyMap<number, string>;

export interface EssSchedulerParameter {
  readonly name: string;
  readonly paramType: 'STRING';
  readonly value: string;
}

/** 轉成 Scheduler REST 的 `requestParameters`：依位置排序，空字串不送。 */
export function toSchedulerParameters(args: EssPositionalArguments): readonly EssSchedulerParameter[] {
  return [...args.entries()]
    .filter(([, value]) => value !== '')
    .sort(([a], [b]) => a - b)
    .map(([index, value]) => ({ name: `submit.argument${index}`, paramType: 'STRING' as const, value }));
}

/**
 * 轉成 `erpintegrations` 的 `ESSParameters`：依位置以逗號串接，中間空位保留空字串，
 * 尾端補到 `length`（job 定義的參數總數）。
 */
export function toErpIntegrationsParameters(args: EssPositionalArguments, length: number): string {
  return Array.from({ length }, (_, index) => args.get(index + 1) ?? '').join(',');
}

/** Scheduler REST 提交回應。`requestId` 欄位不一定存在。 */
export interface EssSchedulerSubmitResponse {
  readonly requestId?: number | string;
  readonly links?: readonly { readonly href?: string }[];
}

/**
 * 取出提交後的 request id。
 *
 * 回應不一定帶 `requestId` 欄位（實測只回 `links`），此時從 `links[].href` 的
 * `/requests/{id}` 取出。兩者皆無時回傳 `null`。
 */
export function extractSchedulerRequestId(response: EssSchedulerSubmitResponse | null | undefined): string | null {
  if (response?.requestId !== undefined && response.requestId !== null) return String(response.requestId);

  const href = (response?.links ?? []).map(link => link.href ?? '').find(link => /\/requests\/\d+/.test(link));

  return href ? (/\/requests\/(\d+)/.exec(href)?.[1] ?? null) : null;
}

export const ESS_SCHEDULER_SUCCESS_STATES: readonly string[] = ['SUCCEEDED'];

export const ESS_SCHEDULER_WARNING_STATES: readonly string[] = ['WARNING'];

export const ESS_SCHEDULER_FAILURE_STATES: readonly string[] = [
  'ERROR',
  'CANCELLED',
  'EXPIRED',
  'ERROR_MANUAL_RECOVERY',
  'FINISHED_WITH_ERRORS',
  'VALIDATION_FAILED',
];

/**
 * Scheduler REST 的終態。
 *
 * `WARNING` 獨立於成功與失敗：job 跑完了但有部分資料未處理，是否算成功取決於 job 本身
 * （通常要讀執行記錄才能判定），不該由傳輸層代為決定。
 */
export type EssSchedulerTerminalState = 'SUCCEEDED' | 'WARNING' | 'FAILED';

/**
 * 把 Scheduler REST 的 `state` 歸類；非終態回傳 `null`。
 *
 * `PAUSED`／`WAIT`／`RUNNING` 等皆為進行中（父 job 等子 job 時會回報 `PAUSED`）。未知狀態同樣
 * 視為進行中——誤判成終態會讓尚在執行的 job 被提早下結論。
 */
export function classifySchedulerState(rawState: string): EssSchedulerTerminalState | null {
  const state = (rawState ?? '').trim().toUpperCase();

  if (ESS_SCHEDULER_SUCCESS_STATES.includes(state)) return 'SUCCEEDED';

  if (ESS_SCHEDULER_WARNING_STATES.includes(state)) return 'WARNING';

  if (ESS_SCHEDULER_FAILURE_STATES.includes(state)) return 'FAILED';

  return null;
}

export interface EssSchedulerStatus {
  /** Fusion 回報的原始 `state`。 */
  readonly rawState: string;
  /** 終態分類；進行中或未知為 `null`。 */
  readonly terminal: EssSchedulerTerminalState | null;
  /** Fusion 附帶的錯誤／警告訊息。 */
  readonly message: string | null;
}

/** `requests/{id}?fields=state,errorWarningMessage` 的回應形狀。 */
export interface EssSchedulerStatusResponse {
  readonly state?: string;
  readonly errorWarningMessage?: string | null;
}

export function parseSchedulerStatusResponse(response: EssSchedulerStatusResponse): EssSchedulerStatus {
  const rawState = response.state ?? '';

  return { rawState, terminal: classifySchedulerState(rawState), message: response.errorWarningMessage ?? null };
}

export interface EssSchedulerJobRequest {
  /**
   * job 定義的完整路徑（package + 名稱），不含 `JobDefinition:/` 前綴，如
   * `oracle/apps/ess/financials/receivables/.../JobName`。
   */
  readonly jobDefinitionPath: string;
  readonly arguments: EssPositionalArguments;
  /** ESS 應用程式，預設 `FscmEss`。 */
  readonly application?: string;
  /** 產品代碼（如 `AR`、`GL`），顯示於 Scheduled Processes。 */
  readonly product?: string;
  /** 顯示於 Scheduled Processes 的說明，利於事後辨識是哪個整合送出的。 */
  readonly description?: string;
  /**
   * Fusion 端的自動重跑次數，預設 0。
   *
   * 維持 0 有兩個理由：非冪等 job 不會被 Fusion 自行重跑，以及失敗時錯誤訊息才會帶出參數名。
   */
  readonly retries?: number;
}

/** 組出 Scheduler REST 的提交 payload。 */
export function buildSchedulerSubmitPayload(request: EssSchedulerJobRequest): Readonly<Record<string, unknown>> {
  return {
    jobDefinitionId: `JobDefinition:/${request.jobDefinitionPath.replace(/^\/+/, '')}`,
    application: request.application ?? FUSION_ESS_DEFAULT_APPLICATION,
    ...(request.product !== undefined ? { product: request.product } : {}),
    ...(request.description !== undefined ? { description: request.description } : {}),
    retries: request.retries ?? 0,
    requestParameters: toSchedulerParameters(request.arguments),
  };
}

/** 單一 request 的狀態查詢路徑。 */
export function buildSchedulerStatusPath(requestId: string): string {
  return `${FUSION_ESS_SCHEDULER_REQUESTS_PATH}/${encodeURIComponent(requestId)}?fields=state,errorWarningMessage`;
}
