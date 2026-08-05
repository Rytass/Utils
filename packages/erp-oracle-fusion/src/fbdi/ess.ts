/**
 * ESS job 的狀態語意。
 *
 * ⚠️ `PAUSED` 是**進行中**而非終態：`importBulkData` 產生的是一個父 job，它在等待子 job
 * （實際的匯入程式）完成時就會回報 `PAUSED`。把它當成失敗或終態會導致匯入被誤判。
 */
export const ESS_IN_PROGRESS_STATUSES: readonly string[] = [
  '',
  'READY',
  'WAIT',
  'SCHEDULED',
  'RUNNING',
  'PROCESSING',
  'PAUSED',
  'BLOCKED',
  'HOLD',
];

export const ESS_SUCCESS_STATUSES: readonly string[] = ['SUCCEEDED'];

export const ESS_FAILURE_STATUSES: readonly string[] = [
  'ERROR',
  'WARNING',
  'CANCELLED',
  'EXPIRED',
  'VALIDATION_FAILED',
];

export type EssJobState = 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';

export interface EssJobStatus {
  /** Fusion 回報的原始狀態字串。 */
  readonly rawStatus: string;
  readonly state: EssJobState;
  /** 終態（成功或失敗）為 true，進行中為 false。`UNKNOWN` 保守視為未結束。 */
  readonly isTerminal: boolean;
}

/** `erpintegrations` 的 ESS 狀態查詢回應形狀。 */
export interface EssJobStatusResponse {
  readonly items?: readonly { readonly RequestStatus?: string }[];
}

/** 把原始狀態字串歸類為進行中／成功／失敗。 */
export function classifyEssStatus(rawStatus: string): EssJobStatus {
  const normalized = (rawStatus ?? '').trim().toUpperCase();

  if (ESS_SUCCESS_STATUSES.includes(normalized)) {
    return { rawStatus, state: 'SUCCEEDED', isTerminal: true };
  }

  if (ESS_FAILURE_STATUSES.includes(normalized)) {
    return { rawStatus, state: 'FAILED', isTerminal: true };
  }

  if (ESS_IN_PROGRESS_STATUSES.includes(normalized)) {
    return { rawStatus, state: 'IN_PROGRESS', isTerminal: false };
  }

  // 未知狀態保守視為未結束——誤判成終態會讓匯入被提早判定失敗。
  return { rawStatus, state: 'UNKNOWN', isTerminal: false };
}

/**
 * Parses the ESS status query response.
 *
 * ⚠️ `ESSJobStatusRF` only resolves requests **submitted through `erpintegrations`**. Jobs started
 * from the Scheduled Processes UI or by Fusion's own schedules come back with an empty
 * `RequestStatus` even when they have finished — verified against a live pod, where a completed
 * scheduled job returned `""` while a job this client had submitted returned `SUCCEEDED`.
 *
 * An empty status is therefore treated as in-progress (never as failure), and `waitForEss` will
 * time out rather than report a wrong outcome. If you need the state of a job you did not submit,
 * read it from the Scheduled Processes UI or a resource that exposes it.
 */
export function parseEssStatusResponse(response: EssJobStatusResponse): EssJobStatus {
  const rawStatus = response.items?.[0]?.RequestStatus ?? '';

  return classifyEssStatus(rawStatus);
}
