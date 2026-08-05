import { FusionRestClient } from '../client/fusion-rest-client';
import { FUSION_RESOURCES } from '../constants/resources';
import type { FusionWriteOptions, FusionRequestOptions } from '../client/fusion-rest-client';
import {
  buildDownloadEssLogPayload,
  buildEssJobPayload,
  buildEssStatusPath,
  buildFbdiImportPayload,
  parseSubmittedRequestId,
} from './erp-integrations';
import type { BuildImportPayloadOptions, EssJobRequest } from './erp-integrations';
import { parseEssStatusResponse } from './ess';
import { unzipFiles } from './zip';
import type { EssJobStatus, EssJobStatusResponse } from './ess';
import type { FbdiFileContent, FbdiTemplate } from '../typings/fbdi';

interface ErpIntegrationsSubmitResponse {
  readonly ReqstId?: string | number;
}

interface DownloadLogResponse {
  readonly DocumentContent?: string;
}

export interface FbdiImportResult {
  /** 父 ESS request id，用於後續查詢狀態。 */
  readonly requestId: string;
}

export interface WaitForEssOptions {
  /** 輪詢間隔（毫秒），預設 5000。 */
  readonly intervalMs?: number;
  /** 總等待上限（毫秒），預設 300000（5 分鐘）。逾時拋錯。 */
  readonly timeoutMs?: number;
  /** 每次輪詢後的回呼，供記錄進度。 */
  readonly onPoll?: (status: EssJobStatus, elapsedMs: number) => void;
}

/**
 * FBDI 匯入的高階流程：打包上傳 → 查詢 ESS 狀態 → 取回執行記錄。
 *
 * 這一層只封裝「與 Fusion 往返」的部分。**排程、outbox、重試策略、狀態機都不在這裡**——
 * 那些屬於消費端的領域邏輯（也才知道什麼情況該重送、什麼情況該進 dead-letter）。
 */
export class FusionFbdiService {
  constructor(private readonly client: FusionRestClient) {}

  /**
   * 打包資料檔並送出 `importBulkData`，回傳父 ESS request id。
   *
   * **不自動重試**（`post` 為非冪等寫入）。若要重送，請先以確定性的批次代碼
   * （見 `deriveGroupId`）確認 Fusion 端是否已匯入過，否則會產生重複資料。
   */
  async import(
    template: FbdiTemplate,
    contents: readonly FbdiFileContent[],
    parameterList: string,
    options?: BuildImportPayloadOptions & { readonly request?: FusionWriteOptions },
  ): Promise<FbdiImportResult> {
    const payload = buildFbdiImportPayload(template, contents, parameterList, options);

    const response = await this.client.post<ErpIntegrationsSubmitResponse>(
      FUSION_RESOURCES.ERP_INTEGRATIONS,
      payload,
      options?.request,
    );

    return { requestId: parseSubmittedRequestId(response.ReqstId, `the import (template: ${template.name})`) };
  }

  /** 直接觸發任一 ESS job（過帳、匯入後處理等），回傳 request id。 */
  async submitEssJob(request: EssJobRequest, options?: FusionWriteOptions): Promise<FbdiImportResult> {
    const response = await this.client.post<ErpIntegrationsSubmitResponse>(
      FUSION_RESOURCES.ERP_INTEGRATIONS,
      buildEssJobPayload(request),
      options,
    );

    return { requestId: parseSubmittedRequestId(response.ReqstId, `the ESS job ${request.jobDefName}`) };
  }

  /** 查詢 ESS job 狀態（冪等 GET，client 會自動重試暫時性錯誤）。 */
  async getEssStatus(requestId: string, options?: FusionRequestOptions): Promise<EssJobStatus> {
    const response = await this.client.get<EssJobStatusResponse>(buildEssStatusPath(requestId), options);

    return parseEssStatusResponse(response);
  }

  /**
   * 輪詢至 ESS job 進入終態。
   *
   * 適用於腳本、測試與短流程；**正式的長流程請用自己的排程器**（本方法會佔住呼叫端的
   * 執行緒，且沒有跨行程的續傳能力）。
   */
  async waitForEss(requestId: string, options?: WaitForEssOptions): Promise<EssJobStatus> {
    const intervalMs = options?.intervalMs ?? 5000;
    const timeoutMs = options?.timeoutMs ?? 300_000;
    const startedAt = Date.now();

    for (;;) {
      const status = await this.getEssStatus(requestId);
      const elapsedMs = Date.now() - startedAt;

      options?.onPoll?.(status, elapsedMs);

      if (status.isTerminal) return status;

      if (elapsedMs + intervalMs > timeoutMs) {
        throw new Error(
          `Fusion ESS job ${requestId} did not reach a terminal state within ${timeoutMs}ms ` +
            `(last status: ${status.rawStatus || 'empty'})`,
        );
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * Retrieves an ESS job's execution log or output.
   *
   * Returns the **decoded bytes**, which are normally a ZIP archive rather than plain text — a log
   * request comes back as an archive containing `<requestId>.log`. Use `unzipFiles()` to read the
   * contents, or `downloadEssLogText()` for the common case.
   *
   * Returns `null` when Fusion has nothing to hand back — which includes jobs not submitted through
   * `erpintegrations` — rather than throwing, since this is usually diagnostic and should not fail
   * the caller's main flow.
   */
  async downloadEssLog(
    requestId: string,
    fileType: 'log' | 'out' = 'log',
    options?: FusionWriteOptions,
  ): Promise<Buffer | null> {
    const response = await this.client.post<DownloadLogResponse>(
      FUSION_RESOURCES.ERP_INTEGRATIONS,
      buildDownloadEssLogPayload(requestId, fileType),
      options,
    );

    if (!response.DocumentContent) return null;

    return Buffer.from(response.DocumentContent, 'base64');
  }

  /**
   * Retrieves an ESS job's log as text, unpacking the archive Fusion returns.
   *
   * Concatenates every entry when the archive holds more than one. Falls back to decoding the
   * payload directly if it turns out not to be an archive.
   */
  async downloadEssLogText(
    requestId: string,
    fileType: 'log' | 'out' = 'log',
    options?: FusionWriteOptions,
  ): Promise<string | null> {
    const raw = await this.downloadEssLog(requestId, fileType, options);

    if (!raw) return null;

    try {
      return unzipFiles(raw)
        .map(entry => entry.content.toString('utf-8'))
        .join('\n');
    } catch {
      return raw.toString('utf-8');
    }
  }
}
