import { FUSION_ERP_OPERATIONS, FUSION_FINDERS, FUSION_RESOURCES } from '../constants/resources';
import { withFusionQuery } from '../query/fusion-query';
import { serializeJobOptions } from './erp-integrations';
import type { FbdiJobOptions } from '../typings/fbdi';

/**
 * Sent where Fusion expects an explicitly empty value rather than an omitted field.
 * The `getDocumentIdsForFilePrefix` finder requires this for unused parameters.
 */
export const FUSION_NULL_VALUE = '#NULL';

/**
 * File types `exportBulkData` can extract. From release 22B the output ZIP can be narrowed to
 * specific types; combine several by passing an array, which is joined with semicolons.
 */
export const FUSION_EXTRACT_FILE_TYPES = {
  ALL: 'ALL',
  CSV: 'CSV',
  XML: 'XML',
  TEXT: 'TEXT',
  LOG: 'LOG',
} as const;

export type FusionExtractFileType = (typeof FUSION_EXTRACT_FILE_TYPES)[keyof typeof FUSION_EXTRACT_FILE_TYPES];

/** `POST erpintegrations` (`OperationName: exportBulkData`). */
export interface ErpIntegrationsExportPayload {
  readonly OperationName: 'exportBulkData';
  readonly JobName: string;
  readonly ParameterList: string;
  readonly JobOptions?: string;
  readonly CallbackURL?: string;
  readonly NotificationCode?: string;
}

export interface BuildExportPayloadOptions {
  /** ESS job to run, as `<package>,<jobDefName>`. */
  readonly jobName: string;
  /** Job parameters, comma-separated; the format is specific to each job. */
  readonly parameterList: string;
  /**
   * Restricts which file types end up in the output ZIP (release 22B and later).
   * Several types may be combined; they are joined with semicolons.
   */
  readonly extractFileType?: FusionExtractFileType | readonly FusionExtractFileType[];
  /** Additional job options merged with `extractFileType`. */
  readonly jobOptions?: FbdiJobOptions;
  /** Callback endpoint; when set, Fusion reports completion instead of requiring polling. */
  readonly callbackUrl?: string | null;
  /** Notification code passed through to the job. */
  readonly notificationCode?: string;
}

/**
 * Builds the `exportBulkData` payload.
 *
 * Fusion runs the reporting job and then automatically submits "Upload Interface Error and Output
 * Details to UCM", which zips the output and logs and uploads them to UCM under the name
 * `ExportBulkData_<JobName>_<ReqstId>.zip`. Retrieval is a two-step process afterwards: resolve the
 * document id from that prefix, then download it.
 */
export function buildExportBulkDataPayload(options: BuildExportPayloadOptions): ErpIntegrationsExportPayload {
  const extractFileType =
    typeof options.extractFileType === 'string' ? options.extractFileType : options.extractFileType?.join(';');

  const jobOptions: FbdiJobOptions = {
    ...(extractFileType ? { ExtractFileType: extractFileType } : {}),
    ...options.jobOptions,
  };

  const serialized = Object.keys(jobOptions).length > 0 ? serializeJobOptions(jobOptions) : undefined;

  return {
    OperationName: FUSION_ERP_OPERATIONS.EXPORT_BULK_DATA,
    JobName: options.jobName,
    ParameterList: options.parameterList,
    ...(serialized !== undefined ? { JobOptions: serialized } : {}),
    ...(options.callbackUrl !== undefined ? { CallbackURL: options.callbackUrl ?? FUSION_NULL_VALUE } : {}),
    ...(options.notificationCode !== undefined ? { NotificationCode: options.notificationCode } : {}),
  };
}

/**
 * The file name prefix Fusion uses for an export's output ZIP.
 *
 * `jobName` here is the bare job definition name (the part after the comma in the ESS job path),
 * which is what appears in the uploaded file name.
 */
export function buildExportFilePrefix(jobDefName: string, requestId: string): string {
  return `ExportBulkData_${jobDefName}_${requestId}`;
}

export interface DocumentIdsQueryOptions {
  /** Restricts the search to a document account; defaults to unset (`#NULL`). */
  readonly documentAccount?: string;
  /** Restricts the search by comment; defaults to unset (`#NULL`). */
  readonly comment?: string;
}

/**
 * Path that resolves UCM document ids from a file name prefix.
 *
 * Unlike most operations on this service this is a **GET with a finder**, not a POST. Unused
 * parameters must be sent as `#NULL` rather than omitted.
 */
export function buildDocumentIdsPath(filePrefix: string, options?: DocumentIdsQueryOptions): string {
  return withFusionQuery(FUSION_RESOURCES.ERP_INTEGRATIONS, {
    finder: {
      name: FUSION_FINDERS.DOCUMENT_IDS_BY_FILE_PREFIX,
      params: {
        filePrefix,
        docAccount: options?.documentAccount ?? FUSION_NULL_VALUE,
        comment: options?.comment ?? FUSION_NULL_VALUE,
      },
    },
  });
}

/** Response shape of the document id finder. */
export interface DocumentIdsResponse {
  readonly items?: readonly { readonly DocumentId?: string | number; readonly FileName?: string }[];
}

/** `POST erpintegrations` (`OperationName: getDocumentForDocumentId`). */
export interface ErpIntegrationsGetDocumentPayload {
  readonly OperationName: 'getDocumentForDocumentId';
  readonly DocumentId: string;
}

/** Builds the payload that downloads a UCM document by id. */
export function buildGetDocumentPayload(documentId: string): ErpIntegrationsGetDocumentPayload {
  return {
    OperationName: FUSION_ERP_OPERATIONS.GET_DOCUMENT_FOR_DOCUMENT_ID,
    DocumentId: documentId,
  };
}

/** `POST erpintegrations` (`OperationName: uploadFileToUCM`). */
export interface ErpIntegrationsUploadPayload {
  readonly OperationName: 'uploadFileToUCM';
  readonly DocumentContent: string;
  readonly FileName: string;
  readonly ContentType: string;
  readonly DocumentAccount: string;
}

export interface BuildUploadPayloadOptions {
  readonly fileName: string;
  readonly documentAccount: string;
  /** Defaults to `zip`, which is what FBDI archives use. */
  readonly contentType?: string;
}

/**
 * Builds an upload-only payload, for the two-step flow where the file is staged in UCM first and
 * the ESS job is submitted separately with the returned document id.
 *
 * Prefer `importBulkData` for ordinary FBDI imports — it does both in one call. The split flow is
 * useful when the same file feeds several jobs, or when upload success must be confirmed before
 * anything is scheduled.
 */
export function buildUploadFilePayload(
  content: Buffer,
  options: BuildUploadPayloadOptions,
): ErpIntegrationsUploadPayload {
  return {
    OperationName: FUSION_ERP_OPERATIONS.UPLOAD_FILE_TO_UCM,
    DocumentContent: content.toString('base64'),
    FileName: options.fileName,
    ContentType: options.contentType ?? 'zip',
    DocumentAccount: options.documentAccount,
  };
}

/** Common response shape carrying a document id or content. */
export interface ErpIntegrationsDocumentResponse {
  readonly DocumentId?: string | number;
  readonly DocumentContent?: string;
  readonly FileName?: string;
  readonly ContentType?: string;
}
