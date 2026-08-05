import {
  FUSION_ERP_OPERATIONS,
  FUSION_FINDERS,
  FUSION_INVALID_REQUEST_ID,
  FUSION_RESOURCES,
} from '../constants/resources';
import { withFusionQuery } from '../query/fusion-query';
import { buildFbdiZip } from './template';
import type { FbdiFileContent, FbdiJobOptions, FbdiTemplate } from '../typings/fbdi';

/** `POST erpintegrations`（`OperationName: importBulkData`）的 payload。 */
export interface ErpIntegrationsImportPayload {
  readonly OperationName: 'importBulkData';
  readonly DocumentContent: string;
  readonly ContentType: 'zip';
  readonly FileName: string;
  readonly DocumentAccount: string;
  readonly JobName: string;
  readonly ParameterList: string;
  /** Comma-separated job options; omitted when neither the template nor the call supplies any. */
  readonly JobOptions?: string;
  /** Callback endpoint, or `#NULL` when callbacks are not used. */
  readonly CallbackURL?: string;
}

/** `POST erpintegrations`（`OperationName: submitESSJobRequest`）的 payload。 */
export interface ErpIntegrationsEssJobPayload {
  readonly OperationName: 'submitESSJobRequest';
  readonly JobPackageName: string;
  readonly JobDefName: string;
  readonly ESSParameters: string;
  /** Document staged by `uploadFileToUCM`, for the two-step import flow. */
  readonly DocumentId?: string;
}

/**
 * `POST erpintegrations` (`OperationName: downloadESSJobExecutionDetails`).
 *
 * Field names are **`ReqstId` and `FileType`**, both PascalCase. Several community sources give
 * these as `requestId`/`fileType`; those are rejected with
 * `400 Invalid attribute "requestId" in the payload` — verified against a live pod.
 */
export interface ErpIntegrationsDownloadLogPayload {
  readonly OperationName: 'downloadESSJobExecutionDetails';
  readonly ReqstId: string;
  readonly FileType: string;
}

/**
 * Validates the `ReqstId` from an `erpintegrations` submission.
 *
 * Fusion returns HTTP 200 with `ReqstId: "-1"` when the job could not be submitted — for example
 * when the job path does not exist — so a successful HTTP status is not enough to conclude the job
 * was accepted.
 */
export function parseSubmittedRequestId(reqstId: string | number | undefined | null, context: string): string {
  if (reqstId === undefined || reqstId === null || reqstId === '') {
    throw new Error(`Fusion erpintegrations response has no ReqstId; ${context} cannot be tracked`);
  }

  const requestId = String(reqstId);

  if (requestId === FUSION_INVALID_REQUEST_ID) {
    throw new Error(
      `Fusion rejected the submission (ReqstId=${FUSION_INVALID_REQUEST_ID}); ${context} was not scheduled. ` +
        'This usually means the ESS job path or definition name does not exist, or the account lacks the ' +
        'privilege to run it.',
    );
  }

  return requestId;
}

/** Sent as `CallbackURL` when callbacks are explicitly disabled. */
export const FUSION_CALLBACK_DISABLED = '#NULL';

/** Serialises job options into the comma-separated form Fusion expects. */
export function serializeJobOptions(jobOptions: FbdiJobOptions): string {
  return Object.entries(jobOptions)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(',');
}

export interface BuildImportPayloadOptions {
  /**
   * `JobOptions` for this import, merged over the template's defaults.
   *
   * Oracle requires this for FBDI imports. `ExtractFileType=ALL` is what makes error and output
   * files available afterwards, and `InterfaceDetails=<id>` identifies the interface layout;
   * without job options a callback never fires even when `callbackUrl` is set.
   */
  readonly jobOptions?: FbdiJobOptions;
  /**
   * Callback endpoint Fusion notifies when the job finishes, removing the need to poll.
   * Requires job options to be present; pass `null` to send `#NULL` explicitly.
   */
  readonly callbackUrl?: string | null;
  /** 覆寫模板的 UCM 帳戶。 */
  readonly documentAccount?: string;
  /** 覆寫模板的 ESS job。 */
  readonly jobName?: string;
  /** 覆寫模板的 zip 檔名。 */
  readonly fileName?: string;
  /** 固定 zip 內的時間戳，供需要位元組可重現輸出的情境使用。 */
  readonly mtime?: Date;
}

/**
 * 依模板把資料檔打包並組成 `importBulkData` payload。
 *
 * `parameterList` 的格式**因 ESS job 而異**（例如 Journal Import 是 7 位逗號分隔），
 * 請用該模板對應的參數建構器產生，不要跨 job 沿用。
 */
export function buildFbdiImportPayload(
  template: FbdiTemplate,
  contents: readonly FbdiFileContent[],
  parameterList: string,
  options?: BuildImportPayloadOptions,
): ErpIntegrationsImportPayload {
  const zipBuffer = buildFbdiZip(template, contents, options?.mtime);
  const jobOptions = { ...template.defaultJobOptions, ...options?.jobOptions };
  const serializedJobOptions = Object.keys(jobOptions).length > 0 ? serializeJobOptions(jobOptions) : undefined;

  return {
    OperationName: FUSION_ERP_OPERATIONS.IMPORT_BULK_DATA,
    DocumentContent: zipBuffer.toString('base64'),
    ContentType: 'zip',
    FileName: options?.fileName ?? template.zipFileName,
    DocumentAccount: options?.documentAccount ?? template.documentAccount,
    JobName: options?.jobName ?? template.jobName,
    ParameterList: parameterList,
    ...(serializedJobOptions !== undefined ? { JobOptions: serializedJobOptions } : {}),
    ...(options?.callbackUrl !== undefined ? { CallbackURL: options.callbackUrl ?? FUSION_CALLBACK_DISABLED } : {}),
  };
}

export interface EssJobRequest {
  /** ESS job package 路徑，如 `/oracle/apps/ess/financials/generalLedger/programs/common/`。 */
  readonly jobPackageName: string;
  /** ESS job definition name，如 `AutomaticPosting`。 */
  readonly jobDefName: string;
  /** ESS 參數，多個參數以逗號分隔（格式依 job 而異）。 */
  readonly parameters: string;
  /**
   * Document id returned by `uploadFileToUCM`, when scheduling a job against a previously
   * staged file rather than uploading inline.
   */
  readonly documentId?: string;
}

/**
 * 組成 `submitESSJobRequest` payload，用於直接觸發任一 ESS job（過帳、匯入後處理等）。
 *
 * job package／definition 的正確字串請以目標環境的 Scheduled Processes UI 核對——同一支
 * job 在不同 Fusion 版本可能位於不同 package 路徑。
 */
export function buildEssJobPayload(request: EssJobRequest): ErpIntegrationsEssJobPayload {
  return {
    OperationName: FUSION_ERP_OPERATIONS.SUBMIT_ESS_JOB_REQUEST,
    JobPackageName: request.jobPackageName,
    JobDefName: request.jobDefName,
    ESSParameters: request.parameters,
    ...(request.documentId !== undefined ? { DocumentId: request.documentId } : {}),
  };
}

/**
 * Builds the payload that retrieves an ESS job's execution log or output.
 *
 * @param fileType `log` for the execution log, `out` for the output file.
 */
export function buildDownloadEssLogPayload(
  requestId: string,
  fileType: 'log' | 'out' = 'log',
): ErpIntegrationsDownloadLogPayload {
  return {
    OperationName: FUSION_ERP_OPERATIONS.DOWNLOAD_ESS_JOB_EXECUTION_DETAILS,
    ReqstId: requestId,
    FileType: fileType,
  };
}

/** Path that queries ESS job status for a request id. */
export function buildEssStatusPath(requestId: string): string {
  return withFusionQuery(FUSION_RESOURCES.ERP_INTEGRATIONS, {
    finder: { name: FUSION_FINDERS.ESS_JOB_STATUS, params: { requestId } },
  });
}
