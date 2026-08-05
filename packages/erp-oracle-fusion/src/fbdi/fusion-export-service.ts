import { FusionRestClient } from '../client/fusion-rest-client';
import type { FusionRequestOptions, FusionWriteOptions } from '../client/fusion-rest-client';
import { FUSION_RESOURCES } from '../constants/resources';
import { parseSubmittedRequestId } from './erp-integrations';
import {
  buildDocumentIdsPath,
  buildExportBulkDataPayload,
  buildExportFilePrefix,
  buildGetDocumentPayload,
  buildUploadFilePayload,
} from './export-payloads';
import type {
  BuildExportPayloadOptions,
  BuildUploadPayloadOptions,
  DocumentIdsQueryOptions,
  DocumentIdsResponse,
  ErpIntegrationsDocumentResponse,
} from './export-payloads';

export interface ExportSubmitResult {
  /** ESS request id of the reporting job. */
  readonly requestId: string;
  /** File name prefix Fusion will use for the output archive. */
  readonly filePrefix: string;
}

export interface UcmDocument {
  readonly documentId: string;
  readonly fileName?: string;
  readonly contentType?: string;
  /** Decoded file bytes. */
  readonly content: Buffer;
}

export interface WaitForDocumentOptions {
  /** Polling interval in milliseconds; defaults to 5000. */
  readonly intervalMs?: number;
  /** Overall wait budget in milliseconds; defaults to 600000 (10 minutes). */
  readonly timeoutMs?: number;
  /** Invoked after each poll, for progress reporting. */
  readonly onPoll?: (found: boolean, elapsedMs: number) => void;
}

/** Extracts the job definition name from an ESS job path of the form `<package>,<jobDefName>`. */
function jobDefNameOf(jobName: string): string {
  const commaIndex = jobName.lastIndexOf(',');

  return commaIndex === -1 ? jobName : jobName.slice(commaIndex + 1);
}

/**
 * Data extraction out of Fusion: run a reporting job, then retrieve its output from UCM.
 *
 * The flow Oracle prescribes has three steps, because the output does not come back in the
 * response — Fusion runs the job, then a follow-up job zips the output and uploads it to UCM:
 *
 * 1. `exportBulkData` returns an ESS request id
 * 2. resolve the UCM document id from the file name prefix `ExportBulkData_<jobDefName>_<requestId>`
 * 3. download the document by id
 *
 * `runExport` performs all three. Supply `callbackUrl` on the submit step instead if you would
 * rather be notified than poll.
 */
export class FusionExportService {
  constructor(private readonly client: FusionRestClient) {}

  /**
   * Submits an export job. **This runs a real ESS job on the pod** — it does not modify business
   * data, but it consumes scheduler capacity and writes an output file to UCM.
   */
  async submitExport(
    options: BuildExportPayloadOptions & { readonly request?: FusionWriteOptions },
  ): Promise<ExportSubmitResult> {
    const response = await this.client.post<{ readonly ReqstId?: string | number }>(
      FUSION_RESOURCES.ERP_INTEGRATIONS,
      buildExportBulkDataPayload(options),
      options.request,
    );

    const requestId = parseSubmittedRequestId(response.ReqstId, `the export job ${options.jobName}`);

    return { requestId, filePrefix: buildExportFilePrefix(jobDefNameOf(options.jobName), requestId) };
  }

  /**
   * Resolves UCM document ids from a file name prefix. Returns an empty array while the output is
   * still being produced — absence is the normal state until the upload job finishes.
   */
  async findDocumentIds(
    filePrefix: string,
    options?: DocumentIdsQueryOptions & { readonly request?: FusionRequestOptions },
  ): Promise<string[]> {
    const response = await this.client.get<DocumentIdsResponse>(
      buildDocumentIdsPath(filePrefix, options),
      options?.request,
    );

    return (response.items ?? [])
      .map(item => item.DocumentId)
      .filter((id): id is string | number => id !== undefined && id !== null && id !== '')
      .map(String);
  }

  /** Downloads a UCM document by id and decodes its content. */
  async downloadDocument(documentId: string, options?: FusionWriteOptions): Promise<UcmDocument> {
    const response = await this.client.post<ErpIntegrationsDocumentResponse>(
      FUSION_RESOURCES.ERP_INTEGRATIONS,
      buildGetDocumentPayload(documentId),
      options,
    );

    if (!response.DocumentContent) {
      throw new Error(`Fusion returned no DocumentContent for document ${documentId}`);
    }

    return {
      documentId,
      fileName: response.FileName,
      contentType: response.ContentType,
      content: Buffer.from(response.DocumentContent, 'base64'),
    };
  }

  /**
   * Polls until the export output appears in UCM, then returns its document ids.
   *
   * Suitable for scripts and short flows. Long-running production extracts should either use a
   * callback or drive the polling from their own scheduler, since this occupies the calling process.
   */
  async waitForDocuments(filePrefix: string, options?: WaitForDocumentOptions): Promise<string[]> {
    const intervalMs = options?.intervalMs ?? 5000;
    const timeoutMs = options?.timeoutMs ?? 600_000;
    const startedAt = Date.now();

    for (;;) {
      const documentIds = await this.findDocumentIds(filePrefix);
      const elapsedMs = Date.now() - startedAt;

      options?.onPoll?.(documentIds.length > 0, elapsedMs);

      if (documentIds.length > 0) return documentIds;

      if (elapsedMs + intervalMs > timeoutMs) {
        throw new Error(`Fusion export output for "${filePrefix}" did not appear within ${timeoutMs}ms`);
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  /** Submits an export, waits for its output and downloads it. */
  async runExport(
    options: BuildExportPayloadOptions & { readonly wait?: WaitForDocumentOptions },
  ): Promise<readonly UcmDocument[]> {
    const { filePrefix } = await this.submitExport(options);
    const documentIds = await this.waitForDocuments(filePrefix, options.wait);

    return Promise.all(documentIds.map(documentId => this.downloadDocument(documentId)));
  }

  /**
   * Stages a file in UCM without scheduling anything, returning its document id for a later
   * `submitEssJob({ documentId })`.
   *
   * **This writes to UCM.** For ordinary FBDI imports prefer `FusionFbdiService.import`, which
   * uploads and schedules in a single call.
   */
  async uploadFile(
    content: Buffer,
    options: BuildUploadPayloadOptions & { readonly request?: FusionWriteOptions },
  ): Promise<string> {
    const response = await this.client.post<ErpIntegrationsDocumentResponse>(
      FUSION_RESOURCES.ERP_INTEGRATIONS,
      buildUploadFilePayload(content, options),
      options.request,
    );

    if (response.DocumentId === undefined || response.DocumentId === null || response.DocumentId === '') {
      throw new Error('Fusion erpintegrations response has no DocumentId; the upload cannot be referenced');
    }

    return String(response.DocumentId);
  }
}
