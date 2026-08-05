/**
 * REST resources, finders and operation names this package works with.
 *
 * Fusion exposes thousands of REST resources across its product families, so this is deliberately
 * **not** an exhaustive catalogue — enumerating them would go stale every release and would imply
 * that anything missing is unsupported. Listed here are only the resources the package itself
 * understands, either because a built-in template targets them or because the client interprets
 * their responses.
 *
 * Any other resource can still be called by passing its path directly to `FusionRestClient`.
 */
export const FUSION_RESOURCES = {
  /** Bulk import, ESS job submission and job log download. */
  ERP_INTEGRATIONS: 'erpintegrations',
  /** GL journal batches, used to verify imports and posting state. */
  JOURNAL_BATCHES: 'journalBatches',
  /** Ledger list of values. */
  LEDGERS_LOV: 'ledgersLOV',
  /** Journal source list of values. */
  JOURNAL_SOURCES_LOV: 'journalSourcesLOV',
  /** Journal category list of values. */
  JOURNAL_CATEGORIES_LOV: 'journalCategoriesLOV',
  /** Accounting period status; requires `ApplicationId` to disambiguate subledgers. */
  ACCOUNTING_PERIOD_STATUS_LOV: 'accountingPeriodStatusLOV',
  /** Chart of accounts value sets; segment values live under `child/values`. */
  VALUE_SETS: 'valueSets',
  /** Tree nodes backing account hierarchies. */
  FND_TREE_NODES: 'fndTreeNodes',
} as const;

/** Named finders used by this package. */
export const FUSION_FINDERS = {
  /** ESS job status by request id. */
  ESS_JOB_STATUS: 'ESSJobStatusRF',
  /** UCM document ids by file name prefix; used to locate export output. */
  DOCUMENT_IDS_BY_FILE_PREFIX: 'DocumentIdsByFilePrefixRF',
} as const;

/** `erpintegrations` operation names. */
export const FUSION_ERP_OPERATIONS = {
  /** Upload and import in one call. */
  IMPORT_BULK_DATA: 'importBulkData',
  /** Stage a file in UCM without scheduling anything. */
  UPLOAD_FILE_TO_UCM: 'uploadFileToUCM',
  SUBMIT_ESS_JOB_REQUEST: 'submitESSJobRequest',
  DOWNLOAD_ESS_JOB_EXECUTION_DETAILS: 'downloadESSJobExecutionDetails',
  /** Run a reporting job and upload its output to UCM. */
  EXPORT_BULK_DATA: 'exportBulkData',
  /** Download a UCM document by id. */
  GET_DOCUMENT_FOR_DOCUMENT_ID: 'getDocumentForDocumentId',
} as const;

/**
 * UCM document accounts for bulk imports. The GL entry is verified; the others follow Oracle's
 * documented naming and should be confirmed against your pod before first use.
 */
export const FUSION_UCM_ACCOUNTS = {
  GL_JOURNAL_IMPORT: 'fin$/journal$/import',
  AP_INVOICE_IMPORT: 'fin$/payables$/import',
  AR_INVOICE_IMPORT: 'fin$/receivables$/import',
  FA_MASS_ADDITIONS_IMPORT: 'fin$/assets$/import',
} as const;

/**
 * The `ApplicationId` that identifies General Ledger in subledger-aware resources such as
 * `accountingPeriodStatusLOV`. Omitting it returns rows from an arbitrary subledger.
 */
export const FUSION_GL_APPLICATION_ID = 101;

/** Sub-path for segment values under a value set. */
export const FUSION_VALUE_SET_VALUES_PATH = 'child/values';

/**
 * Common `JobOptions` keys for FBDI imports.
 *
 * Oracle requires job options on FBDI imports. Their most visible effect is that
 * `ExtractFileType=ALL` makes the job's error and output files available afterwards — without it a
 * failed import often leaves nothing retrievable to diagnose it with. Job options are also a
 * precondition for callbacks: an empty value means no callback fires even when a callback URL is
 * set.
 */
export const FUSION_JOB_OPTION_KEYS = {
  /** Which generated files are extracted back to UCM. `ALL` is the usual choice. */
  EXTRACT_FILE_TYPE: 'ExtractFileType',
  /** Identifies the interface layout; the value is specific to each import job. */
  INTERFACE_DETAILS: 'InterfaceDetails',
  IMPORT_OPTION: 'ImportOption',
  PURGE_OPTION: 'PurgeOption',
} as const;

/** Extracts every generated file back to UCM; safe for any FBDI import. */
export const FUSION_EXTRACT_ALL_FILES = { ExtractFileType: 'ALL' } as const;

/**
 * Sentinel `ReqstId` Fusion returns when a submission was rejected.
 *
 * `erpintegrations` answers **HTTP 200** even when the requested ESS job does not exist or could
 * not be scheduled; the only signal is a request id of `-1`. Treating that as a real id leads to
 * polling for output that will never appear, with the actual cause long since discarded.
 */
export const FUSION_INVALID_REQUEST_ID = '-1';
