// ---------------------------------------------------------------------------
// Resource, finder and operation constants
// ---------------------------------------------------------------------------
export {
  FUSION_ERP_OPERATIONS,
  FUSION_EXTRACT_ALL_FILES,
  FUSION_FINDERS,
  FUSION_JOB_OPTION_KEYS,
  FUSION_GL_APPLICATION_ID,
  FUSION_INVALID_REQUEST_ID,
  FUSION_RESOURCES,
  FUSION_UCM_ACCOUNTS,
  FUSION_VALUE_SET_VALUES_PATH,
} from './constants/resources';

// ---------------------------------------------------------------------------
// Query construction
// ---------------------------------------------------------------------------
export {
  buildFusionQuery,
  withFusionQuery,
  type FusionFinder,
  type FusionQueryOptions,
  type FusionQueryValue,
} from './query/fusion-query';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
export {
  FusionRestClient,
  parseRetryAfter,
  type FusionListResponse,
  type FusionRequestOptions,
  type FusionWriteOptions,
} from './client/fusion-rest-client';
export {
  resolveFusionClientOptions,
  DEFAULT_API_VERSION,
  DEFAULT_MAX_RETRIES,
  DEFAULT_NAMESPACE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
} from './client/resolve-options';
export { FusionAuthProvider } from './auth/fusion-auth-provider';
export { FusionHttpTransport, backoffWithJitter, type FusionTransportRequest } from './transport/fusion-http-transport';

// ---------------------------------------------------------------------------
// SOAP client
//
// Fusion 有一批業務物件沒有對應的 REST 資源（客戶帳戶、AR 信用檔），只能走 SOAP。
// 與 REST client 共用同一組認證、重試與觀測設定。
// ---------------------------------------------------------------------------
export { FusionSoapClient, type FusionSoapCallOptions, type FusionSoapService } from './soap/fusion-soap-client';
export {
  buildSoapEnvelope,
  escapeXml,
  serializeElement,
  ADF_TYPES_NAMESPACE,
  SOAP_ENVELOPE_NAMESPACE,
  XSI_NAMESPACE,
  type BuildSoapEnvelopeOptions,
  type SoapNamespacePrefix,
  type SoapObject,
  type SoapParameter,
  type SoapValue,
} from './soap/envelope';
export {
  buildSoapFaultError,
  classifySoapHttpError,
  findSoapFaultNode,
  normalizeParsedXml,
  parseSoapXml,
} from './soap/soap-fault';
export {
  buildFindCriteria,
  buildFindControl,
  type FusionFindCriteriaOptions,
  type FusionFindFilterItem,
  type FusionFindOperator,
} from './soap/find-criteria';
export {
  FusionCustomerAccountService,
  FUSION_CUSTOMER_ACCOUNT_SERVICE,
  type FusionCustomerAccountCallOptions,
} from './soap/services/fusion-customer-account.service';
export {
  FusionCustomerProfileService,
  FUSION_CUSTOMER_PROFILE_SERVICE,
  type FusionCustomerProfileCallOptions,
} from './soap/services/fusion-customer-profile.service';
export type {
  FusionSoapInput,
  FusionSoapOutput,
  FusionSoapRecord,
  FusionSoapScalar,
  FusionSoapScalarInput,
} from './typings/soap';
export type {
  CustomerAccount,
  CustomerAccountFields,
  CustomerAccountInput,
  CustomerAccountSite,
  CustomerAccountSiteFields,
  CustomerAccountSiteInput,
} from './typings/customer-account';
export type { CustomerProfile, CustomerProfileFields, CustomerProfileInput } from './typings/customer-profile';

// ---------------------------------------------------------------------------
// 設定與型別
// ---------------------------------------------------------------------------
export { normalizeAuthConfig } from './typings/auth';
export type {
  FusionAuthConfig,
  FusionBasicAuthConfig,
  FusionJwtAuthConfig,
  FusionOAuth2AuthConfig,
  ResolvedFusionAuthConfig,
} from './typings/auth';
export type {
  FusionClientOptions,
  FusionOperationResolver,
  ResolvedFusionClientOptions,
} from './typings/client-options';
export type { FusionLogger } from './typings/logger';

// ---------------------------------------------------------------------------
// 錯誤分類
// ---------------------------------------------------------------------------
export {
  classifyFusionHttpError,
  FusionAuthError,
  FusionSoapFaultError,
  FusionTransientError,
  FusionValidationError,
  isFusionRequestError,
  wrapNetworkError,
  type FusionRequestError,
  type FusionSoapAttributeError,
} from './errors/fusion-errors';

// ---------------------------------------------------------------------------
// 觀測
// ---------------------------------------------------------------------------
export {
  FusionApiOperation,
  FusionApiOutcome,
  type FusionCallContext,
  type FusionCallLogEntry,
  type FusionCallLogMethod,
  type FusionCallLogSink,
  type FusionHttpMethod,
  type FusionOperation,
} from './typings/call-log';
export {
  buildResponseSummary,
  classifyOutcome,
  deriveOperation,
  extractFusionRefs,
  redactEndpoint,
  DEFAULT_MAX_TEXT_LENGTH,
  DEFAULT_RESPONSE_REF_KEYS,
  DEFAULT_RESPONSE_SUMMARY_KEYS,
  type ClassifiedOutcome,
} from './call-log/call-log-helpers';

// ---------------------------------------------------------------------------
// FBDI 引擎
// ---------------------------------------------------------------------------
export type { FbdiCellValue, FbdiFileContent, FbdiFileTemplate, FbdiRow, FbdiTemplate, ZipEntry } from './typings/fbdi';
export { buildFbdiCsv, buildFbdiRow, buildFbdiZip, defineFbdiFile, defineFbdiTemplate } from './fbdi/template';
export { crc32, unzipFiles, zipFiles, zipSingleFile } from './fbdi/zip';
export { formatFbdiDate, serializeCsv, truncate } from './fbdi/csv';
export { deriveGroupId } from './fbdi/group-id';
export {
  buildDownloadEssLogPayload,
  buildEssJobPayload,
  buildEssStatusPath,
  buildFbdiImportPayload,
  parseSubmittedRequestId,
  serializeJobOptions,
  FUSION_CALLBACK_DISABLED,
  type BuildImportPayloadOptions,
  type ErpIntegrationsDownloadLogPayload,
  type ErpIntegrationsEssJobPayload,
  type ErpIntegrationsImportPayload,
  type EssJobRequest,
} from './fbdi/erp-integrations';
export {
  classifyEssStatus,
  parseEssStatusResponse,
  ESS_FAILURE_STATUSES,
  ESS_IN_PROGRESS_STATUSES,
  ESS_SUCCESS_STATUSES,
  type EssJobState,
  type EssJobStatus,
  type EssJobStatusResponse,
} from './fbdi/ess';
export { FusionFbdiService, type FbdiImportResult, type WaitForEssOptions } from './fbdi/fusion-fbdi-service';

// ---------------------------------------------------------------------------
// Data extraction and UCM file operations
// ---------------------------------------------------------------------------
export {
  FusionExportService,
  type ExportSubmitResult,
  type UcmDocument,
  type WaitForDocumentOptions,
} from './fbdi/fusion-export-service';
export {
  buildDocumentIdsPath,
  buildExportBulkDataPayload,
  buildExportFilePrefix,
  buildGetDocumentPayload,
  buildUploadFilePayload,
  FUSION_EXTRACT_FILE_TYPES,
  FUSION_NULL_VALUE,
  type BuildExportPayloadOptions,
  type BuildUploadPayloadOptions,
  type DocumentIdsQueryOptions,
  type DocumentIdsResponse,
  type ErpIntegrationsDocumentResponse,
  type ErpIntegrationsExportPayload,
  type ErpIntegrationsGetDocumentPayload,
  type ErpIntegrationsUploadPayload,
  type FusionExtractFileType,
} from './fbdi/export-payloads';

// ---------------------------------------------------------------------------
// 內建模板：GL Journal Import（已對真實 Fusion pod 驗證）
// ---------------------------------------------------------------------------
export {
  buildBatchName,
  buildGlJournalContent,
  buildGlJournalRows,
  buildJournalImportParameterList,
  DEFAULT_BATCH_NAME_PREFIX,
  GL_AUTO_POST_JOB,
  GL_JOURNAL_IMPORT_INTERFACE_DETAILS,
  GL_JOURNAL_IMPORT_JOB_OPTIONS,
  GL_INTERFACE_COLUMN_COUNT,
  GL_INTERFACE_FILE,
  GL_JOURNAL_TEMPLATE,
  REFERENCE_MAX_LENGTH,
  type GlJournalBuildConfig,
  type GlJournalInput,
  type GlJournalLineInput,
  type JournalImportParameterListConfig,
} from './fbdi/templates/gl-journal';
