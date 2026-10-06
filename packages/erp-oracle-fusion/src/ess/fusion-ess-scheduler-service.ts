import { FusionRestClient } from '../client/fusion-rest-client';
import type { FusionRequestOptions, FusionWriteOptions } from '../client/fusion-rest-client';
import { parseSubmittedRequestId } from '../fbdi/erp-integrations';
import {
  buildSchedulerStatusPath,
  buildSchedulerSubmitPayload,
  extractSchedulerRequestId,
  FUSION_ESS_SCHEDULER_REQUESTS_PATH,
  parseSchedulerStatusResponse,
} from './scheduler';
import type {
  EssSchedulerJobRequest,
  EssSchedulerStatus,
  EssSchedulerStatusResponse,
  EssSchedulerSubmitResponse,
} from './scheduler';

export interface EssSchedulerSubmitResult {
  readonly requestId: string;
}

/**
 * ESS Scheduler REST：提交 job 與查詢狀態。
 *
 * 與 `FusionFbdiService`（`erpintegrations` 通道）互補——有些 job 只在這條通道上可用，而狀態
 * 查詢則是兩條通道送出的請求都查得到。執行記錄仍由 `FusionFbdiService.downloadEssLogText()`
 * 下載，對這條通道送出的請求同樣有效。
 *
 * 請求必須由 API 帳號提交：整合帳號讀不到其他使用者在 UI 上提交的請求（`ESS-02003`）。
 *
 * 排程、重試策略與結果判讀都不在這裡——`WARNING` 算不算成功、執行記錄要怎麼解析，是各個 job
 * 與消費端的事。
 */
export class FusionEssSchedulerService {
  constructor(private readonly client: FusionRestClient) {}

  /** 提交 job，回傳 request id。**不自動重試**（非冪等寫入）。 */
  async submit(request: EssSchedulerJobRequest, options?: FusionWriteOptions): Promise<EssSchedulerSubmitResult> {
    const response = await this.client.post<EssSchedulerSubmitResponse>(
      FUSION_ESS_SCHEDULER_REQUESTS_PATH,
      buildSchedulerSubmitPayload(request),
      { ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) } },
    );

    const requestId = extractSchedulerRequestId(response);

    if (requestId === null) {
      throw new Error(
        `Fusion ESS scheduler response has no request id; the ESS job ${request.jobDefinitionPath} cannot be tracked`,
      );
    }

    return { requestId: parseSubmittedRequestId(requestId, `the ESS job ${request.jobDefinitionPath}`) };
  }

  /** 查詢狀態（冪等 GET，client 會自動重試暫時性錯誤）。 */
  async getStatus(requestId: string, options?: FusionRequestOptions): Promise<EssSchedulerStatus> {
    const response = await this.client.get<EssSchedulerStatusResponse>(buildSchedulerStatusPath(requestId), options);

    return parseSchedulerStatusResponse(response);
  }
}
