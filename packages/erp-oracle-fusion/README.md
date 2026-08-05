# Rytass Utils - Oracle Fusion ERP Client

REST client and FBDI toolkit for Oracle Fusion Cloud ERP. Handles authentication, retry policy,
error classification, observability instrumentation and FBDI packaging, with zero runtime
dependencies and no framework coupling.

Scheduling, outbox patterns, dead-letter handling, document state machines and master-data mapping
are deliberately left to the consuming application, which is the only layer that knows when a
failure should be retried and when it should be escalated.

For NestJS applications, use [`@rytass/erp-oracle-fusion-nestjs`](../erp-oracle-fusion-nestjs).

## Features

- [x] OAuth 2.0 client credentials (default) with TTL cache and early refresh
- [x] Pre-issued JWT bearer tokens, static or refreshed per request
- [x] HTTP Basic for test pods
- [ ] SAML 2.0 bearer assertions (obtain the token yourself and pass it as a JWT)
- [x] Idempotency-aware retry: exponential backoff for reads, never for writes
- [x] Error classification that drives retry decisions (auth / validation / transient)
- [x] Automatic pagination that follows the server's page size, not the requested one
- [x] Structured Oracle error codes, including the nested `o:errorDetails` form
- [x] Pinnable `REST-Framework-Version`
- [x] `Retry-After` awareness and jittered backoff
- [x] Configurable REST namespace and API version (`fscmRestApi`, `crmRestApi`, `hcmRestApi`, ...)
- [x] Query builder for Fusion's `q` / `finder` / pagination syntax, with the right escaping
- [x] Constants for the resources, finders and UCM accounts the package understands
- [x] Request timeout via `AbortSignal`, classified as retryable
- [x] Injectable `fetch` implementation for corporate proxies and client certificates
- [x] Pluggable observability sink with a redaction contract
- [x] FBDI template engine: every import defined as data, not code
- [x] Multi-file ZIP archives, required by AP and AR style imports
- [x] `JobOptions` and `CallbackURL` on imports
- [x] Data extraction: `exportBulkData` and UCM document retrieval
- [x] Two-step staging via `uploadFileToUCM` + `DocumentId`
- [x] Built-in GL Journal Import template (149 columns, verified against a live pod)
- [x] ESS job submission, status polling and execution log retrieval
- [x] ZIP reading (STORED and DEFLATE) for the archives Fusion returns
- [ ] Built-in AP / AR / FA templates (define your own through the template API)
- [ ] SOAP, BI Publisher / OTBI

## Installation

```bash
npm install @rytass/erp-oracle-fusion
# or
yarn add @rytass/erp-oracle-fusion
```

## Quick Start

```ts
import { FusionRestClient } from '@rytass/erp-oracle-fusion';

const client = new FusionRestClient({
  baseUrl: 'https://your-pod.fa.ap1.oraclecloud.com',
  auth: {
    // type defaults to 'oauth2_client_credentials'
    tokenUrl: 'https://idcs-xxx.identity.oraclecloud.com/oauth2/v1/token',
    clientId: process.env.FUSION_CLIENT_ID!,
    clientSecret: process.env.FUSION_CLIENT_SECRET!,
    scope: 'urn:opc:resource:consumer::all',
  },
});

const ledgers = await client.get<{ items: Ledger[] }>('ledgersLOV?limit=5');
```

## Configuration

### FusionClientOptions

| Property              | Type                      | Required | Default                    | Description                                                |
| --------------------- | ------------------------- | -------- | -------------------------- | ---------------------------------------------------------- |
| `baseUrl`             | `string`                  | Yes      | -                          | Pod root URL; trailing slashes are stripped automatically  |
| `auth`                | `FusionAuthConfig`        | Yes      | -                          | See authentication strategies below                        |
| `defaultNamespace`    | `string`                  | No       | `'fscmRestApi'`            | REST namespace, overridable per request                    |
| `defaultApiVersion`   | `string`                  | No       | `'11.13.18.05'`            | REST version segment, overridable per request              |
| `maxRetries`          | `number`                  | No       | `3`                        | Retry attempts for idempotent GET requests                 |
| `retryBaseDelayMs`    | `number`                  | No       | `500`                      | Backoff base; attempt n waits `base * 2^(n-1)`             |
| `defaultPageSize`     | `number`                  | No       | `500`                      | Page size used by `getAll()`                               |
| `timeoutMs`           | `number`                  | No       | `60000`                    | Per-request timeout; `0` disables it                       |
| `fetchImpl`           | `typeof fetch`            | No       | `globalThis.fetch`         | Inject a proxied or instrumented fetch                     |
| `operationResolver`   | `FusionOperationResolver` | No       | Built-in ERP rules         | Classifies calls for observability; may return any string  |
| `responseRefKeys`     | `readonly string[]`       | No       | `['ReqstId', 'JeBatchId']` | Response fields extracted into `entry.refs`                |
| `responseSummaryKeys` | `readonly string[]`       | No       | See below                  | Allow-list for `responseSummary`                           |
| `maxTextLength`       | `number`                  | No       | `2000`                     | Truncation limit for error messages and summaries          |
| `callLogSink`         | `FusionCallLogSink`       | No       | none                       | Destination for call records; omitted means no persistence |
| `logger`              | `FusionLogger`            | No       | none                       | Bridge to NestJS Logger, pino, winston, and so on          |

Default `responseSummaryKeys`: `ReqstId`, `JeBatchId`, `Status`, `StatusMeaning`, `PostedDate`,
`RequestStatus`.

### Authentication Strategies

Fusion protects its REST endpoints with the `oracle/multi_token_over_ssl_rest_service_policy` OWSM
policy, which accepts OAuth 2.0, JWT, SAML 2.0 bearer tokens and HTTP Basic over SSL. This package
implements the first three; for SAML, exchange the assertion yourself and pass the resulting token
through the `jwt` strategy.

| `auth.type`                           | Fields                                                               | Use case                    |
| ------------------------------------- | -------------------------------------------------------------------- | --------------------------- |
| `oauth2_client_credentials` (default) | `tokenUrl`, `clientId`, `clientSecret`, `scope?`, `refreshBufferMs?` | Production integrations     |
| `jwt`                                 | `token`                                                              | SSO and federated identity  |
| `basic`                               | `username`, `password`                                               | Test pods and probe scripts |

```ts
// OAuth (default) — type may be omitted
auth: {
  tokenUrl: 'https://idcs-xxx.identity.oraclecloud.com/oauth2/v1/token',
  clientId: '...',
  clientSecret: '...',
  scope: 'urn:opc:resource:consumer::all',
}

// JWT issued elsewhere — static, or a function for short-lived tokens
auth: { type: 'jwt', token: process.env.FUSION_JWT! }
auth: { type: 'jwt', token: async () => myTokenBroker.getFusionToken() }

// Basic must be stated explicitly
auth: { type: 'basic', username: '...', password: '...' }
```

`scope` accepts a string or an array. The wire format is a single space-delimited string
(RFC 6749 section 3.3), and arrays are joined for you:

```ts
scope: ['urn:opc:resource:consumer::all', 'https://your-pod/custom']
// sent as: scope=urn:opc:resource:consumer::all https://your-pod/custom
```

When `token` is a function it is invoked on **every** request, so cache inside it if minting is
expensive. Unlike the OAuth strategy, this package cannot cache JWTs for you because it has no way
to know when yours expires.

Basic authentication is accepted by Fusion but unsuitable for production: the password travels on
every request, cannot be rotated independently of the user, and ties the integration to a single
named account.

## Usage

### REST Requests

```ts
// Idempotent GET, retried on 429, 5xx, network errors and timeouts
const ledger = await client.get<Ledger>('ledgersLOV?q=Name=Primary');

// Fetch an entire collection, following pagination automatically
const values = await client.getAll<ValueItem>('valueSets/MY_SET/child/values');

// Write, never retried automatically
const result = await client.post<ImportResponse>('erpintegrations', payload);

// Switch REST namespace for a single call
const account = await client.get<Account>('accounts/123', { namespace: 'crmRestApi' });

// Pod-absolute path, bypassing namespace composition
const custom = await client.get<unknown>('/myCustomApi/v1/things');
```

Read methods accept `FusionRequestOptions` (`maxRetries`, `namespace`, `apiVersion`, `headers`,
`context`). Write methods accept `FusionWriteOptions`, which omits `maxRetries` at the type level
because those methods never retry.

Requests carrying a body default to `Content-Type: application/vnd.oracle.adf.resourceitem+json`.
Override it through `headers` when a different content type is required.

### Building Queries

Fusion's query syntax is well defined but easy to get subtly wrong: `q` conditions join with `;`,
finders carry their own parameters, and the two escape differently. `withFusionQuery` assembles the
string for you.

```ts
import { FUSION_GL_APPLICATION_ID, FUSION_RESOURCES, withFusionQuery } from '@rytass/erp-oracle-fusion';

// q= conditions, joined with ; and percent-encoded as a whole
await client.get(
  withFusionQuery(FUSION_RESOURCES.ACCOUNTING_PERIOD_STATUS_LOV, {
    q: { LedgerId: ledgerId, PeriodNameId: 'Jul-26', ApplicationId: FUSION_GL_APPLICATION_ID },
  }),
);

// finder=Name;param=value, with only the values encoded
await client.get(
  withFusionQuery(FUSION_RESOURCES.ERP_INTEGRATIONS, {
    finder: { name: FUSION_FINDERS.ESS_JOB_STATUS, params: { requestId } },
  }),
);

// pagination, projection, expansion and ordering
await client.get(
  withFusionQuery(FUSION_RESOURCES.JOURNAL_BATCHES, {
    limit: 50,
    offset: 100,
    fields: ['JeBatchId', 'Name', 'PostedDate'],
    orderBy: ['CreationDate:desc'],
    onlyData: true,
  }),
);
```

Pass a string to `q` when you need operators Fusion supports but the object form cannot express:

```ts
withFusionQuery(FUSION_RESOURCES.JOURNAL_BATCHES, { q: `BatchName LIKE '%${groupId}%'` });
```

`FusionQueryOptions` covers `q`, `finder`, `limit`, `offset`, `fields`, `expand`, `orderBy`,
`onlyData`, `totalResults` and an escape hatch `params` for anything else.

### Resource Constants

`FUSION_RESOURCES`, `FUSION_FINDERS`, `FUSION_ERP_OPERATIONS` and `FUSION_UCM_ACCOUNTS` name the
resources this package understands — the ones a built-in template targets or whose responses the
client interprets.

This is deliberately **not** a catalogue of every Fusion resource: there are thousands across the
product families and they change every release, so an incomplete list would imply that anything
missing is unsupported. Every other resource is reachable by passing its path directly.

```ts
FUSION_RESOURCES.ERP_INTEGRATIONS;          // 'erpintegrations'
FUSION_RESOURCES.JOURNAL_BATCHES;           // 'journalBatches'
FUSION_FINDERS.ESS_JOB_STATUS;              // 'ESSJobStatusRF'
FUSION_UCM_ACCOUNTS.GL_JOURNAL_IMPORT;      // 'fin$/journal$/import'
FUSION_GL_APPLICATION_ID;                   // 101, required by subledger-aware resources
```

### REST Framework Version

Fusion defaults to **framework version 1** when the `REST-Framework-Version` header is absent — the
oldest behaviour. Payload handling differs across versions (list-valued attributes are
comma-separated up to version 7 but must be arrays from version 8), and child collections are only
paginated under `expand`/`fields` from version 3 onward. The same request can therefore be accepted
by one version and rejected by another.

```ts
new FusionRestClient({ baseUrl, auth, restFrameworkVersion: 8 });
await client.get('resource', { restFrameworkVersion: 3 }); // per-call override
```

Nothing is sent when the option is omitted, so the pod's default applies. Pinning a version is
recommended: it prevents a pod upgrade from silently changing how your payloads are interpreted.
A resource's supported versions appear in `defaultFrameworkVersion` and `allowedFrameworkVersions`
on its `describe` response.

### Timeouts, Proxies and Client Certificates

```ts
import { ProxyAgent } from 'undici';

const client = new FusionRestClient({
  baseUrl,
  auth,
  timeoutMs: 30_000,
  fetchImpl: (input, init) =>
    fetch(input, { ...init, dispatcher: new ProxyAgent(process.env.HTTPS_PROXY!) } as RequestInit),
});
```

Timeouts are classified as `FusionTransientError`, so idempotent requests retry them under the
configured backoff policy. Note that `fetch` does not honour `HTTP_PROXY` environment variables;
proxies have to be injected explicitly.

## Error Handling

```ts
try {
  await client.post('erpintegrations', payload);
} catch (error) {
  if (error instanceof FusionValidationError) {
    // 400: the request itself is wrong, retrying will not help. Route to dead-letter.
    // error.body carries Oracle's original payload, including o:errorCode.
  } else if (error instanceof FusionAuthError) {
    // 401 or 403: role or grant problem. Alert operations, do not retry.
  } else if (error instanceof FusionTransientError) {
    // 429, 5xx, network failure or timeout. Safe to retry from your own scheduler.
  }
}
```

Write methods do not retry by design. If you retry them yourself you **must** supply an idempotency
key: `importBulkData` has no native deduplication, so a blind resend creates duplicate documents.
`deriveGroupId()` exists for exactly this.

## FBDI

FBDI CSVs are headerless and purely positional. This package models "which field lives in which
column" as template data, so one engine handles every import type.

### Using the Built-in GL Journal Template

```ts
import {
  FusionFbdiService,
  GL_JOURNAL_TEMPLATE,
  buildGlJournalContent,
  buildGlJournalRows,
  buildJournalImportParameterList,
  deriveGroupId,
} from '@rytass/erp-oracle-fusion';

const fbdi = new FusionFbdiService(client);
const groupId = deriveGroupId('voucher-1'); // deterministic, derived from your document id

const rows = buildGlJournalRows(
  { sourceKey: 'voucher-1', accountingDate: '2026-06-30', currencyCode: 'TWD', description: 'Cost allocation' },
  [
    { accountCode: '759000000', departmentCode: 'AA110', debit: 100, credit: 0 },
    { accountCode: '759000000', departmentCode: '00000', debit: 0, credit: 100 },
  ],
  {
    ledgerId: '300000002498206',
    journalSource: 'Manual',
    journalCategory: 'Adjustment',
    periodName: 'Jun-26',
    groupId,
    companySegmentDefault: '01',
    extraSegmentDefaults: ['0000', '0000'],
    batchNamePrefix: 'MYAPP',
  },
);

const { requestId } = await fbdi.import(
  GL_JOURNAL_TEMPLATE,
  [buildGlJournalContent(rows)],
  buildJournalImportParameterList({ journalSource: 'Manual', ledgerId: '300000002498206', groupId }),
);
```

The 149-column `GL_INTERFACE` mapping comes from Oracle's official 25c FBDI template
(`JournalImportTemplate.xlsm`) and has been verified end to end against a live Fusion pod.

> **Note**
> `buildJournalImportParameterList` produces the seven-position parameter string specific to Journal
> Import. Other ESS jobs use entirely different parameter formats; do not reuse it.

### Job Options and Callbacks

Oracle requires `JobOptions` on FBDI imports. The import still runs without them, but two things
silently stop working: **error and output files are not extracted back to UCM**, and **callbacks
never fire** — even when a callback URL is supplied. If a failed import has ever left you with no
retrievable detail, this is usually why.

```ts
import { FUSION_EXTRACT_ALL_FILES, GL_JOURNAL_IMPORT_INTERFACE_DETAILS } from '@rytass/erp-oracle-fusion';

await fbdi.import(GL_JOURNAL_TEMPLATE, contents, parameterList, {
  jobOptions: { ...FUSION_EXTRACT_ALL_FILES, InterfaceDetails: GL_JOURNAL_IMPORT_INTERFACE_DETAILS },
  callbackUrl: 'https://my-service/fusion-callback',
});
```

| Key                           | Effect                                                                      |
| ----------------------------- | --------------------------------------------------------------------------- |
| `ExtractFileType`             | Which generated files return to UCM; `ALL` is what makes errors retrievable |
| `InterfaceDetails`            | Identifies the interface layout; the value is specific to each import job   |
| `ImportOption`, `PurgeOption` | Import and purge behaviour                                                  |

A template can declare `defaultJobOptions`, which per-call options are merged over.

> **Warning**
> `GL_JOURNAL_IMPORT_INTERFACE_DETAILS` (15) is community-sourced and **not verified against a live
> pod**. The verified import path in this package runs without `InterfaceDetails` at all, so the
> built-in GL template does not apply it by default — a wrong value stops the job from locating the
> interface layout and turns a working import into a failing one. Confirm it in your environment
> before adopting it. `ExtractFileType=ALL` carries no such risk.

Callbacks require job options to be present. Pass `callbackUrl: null` to send `#NULL` explicitly.

### Defining Custom Templates

Most FBDI imports require several CSVs inside one archive. AP invoices, for example, need a header
file and a lines file. The engine supports this natively.

```ts
import { defineFbdiFile, defineFbdiTemplate } from '@rytass/erp-oracle-fusion';

const AP_INVOICES = defineFbdiFile({
  entryFileName: 'ApInvoicesInterface.csv',
  columnCount: 190, // from the official FBDI template for your Fusion version
  columns: { INVOICE_ID: 0, INVOICE_NUM: 3, VENDOR_NUM: 8, INVOICE_AMOUNT: 12 },
});

const AP_INVOICE_LINES = defineFbdiFile({
  entryFileName: 'ApInvoiceLinesInterface.csv',
  columnCount: 250,
  columns: { INVOICE_ID: 0, LINE_NUMBER: 1, AMOUNT: 4 },
});

const AP_INVOICE_IMPORT = defineFbdiTemplate({
  name: 'AP Invoice Import',
  documentAccount: 'fin$/payables$/import',
  jobName: '/oracle/apps/ess/financials/payables/invoices/transactions,APXIIMPT',
  zipFileName: 'ApInvoiceImport.zip',
  files: [AP_INVOICES, AP_INVOICE_LINES],
});
```

`defineFbdiFile` and `defineFbdiTemplate` validate index collisions, out-of-range indexes and
duplicate file names at definition time. `buildFbdiRow` **throws on unknown column names**: with
positional CSVs a silently dropped typo surfaces later as an unrelated "required field is empty"
error from Fusion, which is very hard to trace back.

Column counts and indexes must come from the FBDI template matching your Fusion version, published
at `https://www.oracle.com/webfolder/technetwork/docs/fbdi-<version>/`.

### End-to-End Import

```ts
const fbdi = new FusionFbdiService(client);
const sourceKey = 'invoice-batch-2026-08';

const { requestId } = await fbdi.import(
  AP_INVOICE_IMPORT,
  [
    { entryFileName: 'ApInvoicesInterface.csv', rows: headerRows },
    { entryFileName: 'ApInvoiceLinesInterface.csv', rows: lineRows },
  ],
  parameterList,
  { request: { context: { correlationType: 'INVOICE_BATCH', correlationId: sourceKey } } },
);

const status = await fbdi.waitForEss(requestId, { intervalMs: 5000, timeoutMs: 600_000 });

if (status.state === 'FAILED') {
  const log = await fbdi.downloadEssLog(requestId);

  throw new Error(`FBDI import failed: ${status.rawStatus}\n${log ?? '(no log available)'}`);
}
```

### ESS Jobs

```ts
// Submit any ESS job directly
const { requestId } = await fbdi.submitEssJob({
  jobPackageName: '/oracle/apps/ess/financials/generalLedger/programs/common/',
  jobDefName: 'AutomaticPosting',
  parameters: criteriaSetId,
});

// Poll status
const status = await fbdi.getEssStatus(requestId); // { rawStatus, state, isTerminal }

// Retrieve the execution log. Fusion returns a ZIP, not plain text.
const archive = await fbdi.downloadEssLog(requestId);        // Buffer | null
const text = await fbdi.downloadEssLogText(requestId);       // unpacked, concatenated
unzipFiles(archive!).forEach(f => console.log(f.name, f.content.length));
```

> **Note**
> A log request returns an archive containing one entry per job in the tree — a parent FBDI import
> yields its own log plus one for each child job. Verified against a live pod: a single import
> returned a 4 KB archive holding three logs totalling 25 KB.

> **Warning**
> `ESSJobStatusRF` only resolves requests **submitted through `erpintegrations`**. Jobs started from
> the Scheduled Processes UI or by Fusion's own schedules return an empty `RequestStatus` even after
> they finish, so `waitForEss` would poll until it times out. Verified against a live pod: a
> completed scheduled job returned `""` while a job submitted by this client returned `SUCCEEDED`.

> **Warning**
> `PAUSED` means *in progress*, not finished. `importBulkData` creates a parent job that reports
> `PAUSED` while waiting on its child jobs, so treating it as terminal makes successful imports look
> like failures. Use `classifyEssStatus()` instead of comparing status strings; unknown statuses are
> conservatively treated as non-terminal.

`waitForEss` is meant for scripts, tests and short flows. Production flows should use your own
scheduler, since the helper occupies the calling process and cannot resume across restarts.

## Data Extraction

Getting data out of Fusion is a three-step flow, because output never comes back in the response:
Fusion runs the reporting job, then a follow-up job zips the output and uploads it to UCM under
`ExportBulkData_<jobDefName>_<requestId>.zip`.

```ts
import { FusionExportService, FUSION_EXTRACT_FILE_TYPES } from '@rytass/erp-oracle-fusion';

const exporter = new FusionExportService(client);

// All three steps in one call
const documents = await exporter.runExport({
  jobName: '/oracle/apps/ess/financials/receivables/.../BillingHistoryExtract',
  parameterList: '2026-01-01,2026-01-31',
  extractFileType: FUSION_EXTRACT_FILE_TYPES.CSV,
  wait: { intervalMs: 5000, timeoutMs: 600_000 },
});

documents.forEach(doc => writeFileSync(doc.fileName ?? `${doc.documentId}.zip`, doc.content));
```

Drive the steps yourself when the wait belongs in your own scheduler:

```ts
const { requestId, filePrefix } = await exporter.submitExport({ jobName, parameterList });
// ... later, from a scheduled worker
const documentIds = await exporter.findDocumentIds(filePrefix); // empty until output is ready
const document = await exporter.downloadDocument(documentIds[0]);
```

> **Warning**
> `erpintegrations` answers **HTTP 200 even when a submission is rejected** — an unknown job path
> comes back as `ReqstId: "-1"` with a success status. This package treats `-1` as a failure and
> throws, because the alternative is polling for output that will never appear while the real cause
> is discarded. Verified against a live pod.

Supply `callbackUrl` on `submitExport` to be notified instead of polling. From release 22B,
`extractFileType` narrows the archive to specific file types (`CSV`, `XML`, `TEXT`, `LOG`); pass an
array to combine them.

### Staging Files in UCM

For the two-step import flow — useful when one file feeds several jobs, or when upload success must
be confirmed before anything is scheduled:

```ts
const documentId = await exporter.uploadFile(zipBuffer, {
  fileName: 'GlInterface.zip',
  documentAccount: FUSION_UCM_ACCOUNTS.GL_JOURNAL_IMPORT,
});

await fbdi.submitEssJob({ jobPackageName, jobDefName, parameters, documentId });
```

Ordinary FBDI imports should still use `FusionFbdiService.import`, which does both in one call.

## Observability

Implement `FusionCallLogSink` to persist every call:

```ts
const client = new FusionRestClient({
  baseUrl,
  auth,
  callLogSink: {
    record: async entry => {
      try {
        await repository.insert(entry);
      } catch {
        // Contract: the sink must never throw.
      }
    },
  },
  responseRefKeys: ['ReqstId', 'JeBatchId'],
  operationResolver: (method, path) => (path.startsWith('accounts') ? 'GET_CRM_ACCOUNT' : 'OTHER'),
});
```

One record is written per call, for successes and final failures alike, with `latencyMs` and
`attempt` covering the entire retry cycle. `operation` is typed as `FusionOperation` (the built-in
enum or any string) and `refs` is an open `Record<string, string>`, so no module-specific fields are
baked into the contract.

**Redaction contract:** `endpoint` always has its query string removed and `responseSummary` carries
allow-listed fields only. Never add `DocumentContent` (base64 file payloads), tokens or whole
request bodies to `responseSummaryKeys`.

## API Reference

Every function's options object is exported as a same-named type (for example
`BuildExportPayloadOptions` for `buildExportBulkDataPayload`); those are omitted from the tables
below for brevity.

### Client

| Export                                                                                                                                      | Description                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `FusionRestClient`                                                                                                                          | `get`, `getAll`, `post`, `patch`, `delete`, `resourceUrl`     |
| `FusionAuthProvider`                                                                                                                        | `getAuthorizationHeader`, `getAccessToken`, `invalidateToken` |
| `resolveFusionClientOptions`                                                                                                                | Applies defaults; useful when assembling the client manually  |
| `parseRetryAfter`                                                                                                                           | Parses `Retry-After` (delay-seconds or HTTP date)             |
| `DEFAULT_NAMESPACE`, `DEFAULT_API_VERSION`, `DEFAULT_MAX_RETRIES`, `DEFAULT_RETRY_BASE_DELAY_MS`, `DEFAULT_PAGE_SIZE`, `DEFAULT_TIMEOUT_MS` | Default values applied by `resolveFusionClientOptions`        |

### Query and Constants

| Export                                                     | Description                                           |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `buildFusionQuery`, `withFusionQuery`                      | Query string construction                             |
| `FUSION_RESOURCES`, `FUSION_FINDERS`                       | Resource and finder names the package understands     |
| `FUSION_ERP_OPERATIONS`, `FUSION_UCM_ACCOUNTS`             | `erpintegrations` operations and bulk-import accounts |
| `FUSION_GL_APPLICATION_ID`, `FUSION_VALUE_SET_VALUES_PATH` | Values required by specific resources                 |


### Errors

| Export                                                             | Description                               |
| ------------------------------------------------------------------ | ----------------------------------------- |
| `FusionAuthError`, `FusionValidationError`, `FusionTransientError` | The three error classes                   |
| `isFusionRequestError`                                             | Type guard                                |
| `classifyFusionHttpError`, `wrapNetworkError`                      | Classification helpers for custom callers |

### Observability

| Export                                                                                  | Description                         |
| --------------------------------------------------------------------------------------- | ----------------------------------- |
| `FusionApiOperation`, `FusionApiOutcome`                                                | Built-in classification enums       |
| `deriveOperation`, `redactEndpoint`                                                     | Built-in classification and masking |
| `extractFusionRefs`, `buildResponseSummary`, `classifyOutcome`                          | Pure helpers, usable standalone     |
| `DEFAULT_RESPONSE_REF_KEYS`, `DEFAULT_RESPONSE_SUMMARY_KEYS`, `DEFAULT_MAX_TEXT_LENGTH` | Defaults                            |


### FBDI Engine

| Export                                                                      | Description                                                                                    |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `defineFbdiFile`, `defineFbdiTemplate`                                      | Template definition with validation                                                            |
| `buildFbdiRow`, `buildFbdiCsv`, `buildFbdiZip`                              | Row, CSV and archive construction                                                              |
| `buildFbdiImportPayload`                                                    | `importBulkData` payload                                                                       |
| `serializeJobOptions`, `FUSION_JOB_OPTION_KEYS`, `FUSION_EXTRACT_ALL_FILES` | `JobOptions` construction                                                                      |
| `FUSION_CALLBACK_DISABLED`                                                  | `#NULL`, sent when callbacks are explicitly off                                                |
| `buildEssJobPayload`, `buildDownloadEssLogPayload`, `buildEssStatusPath`    | ESS payloads and paths                                                                         |
| `classifyEssStatus`, `parseEssStatusResponse`                               | ESS status semantics                                                                           |
| `ESS_IN_PROGRESS_STATUSES`, `ESS_SUCCESS_STATUSES`, `ESS_FAILURE_STATUSES`  | Status sets behind `classifyEssStatus`                                                         |
| `parseSubmittedRequestId`, `FUSION_INVALID_REQUEST_ID`                      | Rejects the `-1` sentinel Fusion returns on a failed submission                                |
| `FusionFbdiService`                                                         | `import`, `submitEssJob`, `getEssStatus`, `waitForEss`, `downloadEssLog`, `downloadEssLogText` |
| `zipFiles`, `zipSingleFile`, `crc32`                                        | ZIP writing with multi-file support                                                            |
| `unzipFiles`                                                                | ZIP reading (STORED and DEFLATE), for the archives Fusion returns                              |
| `serializeCsv`, `formatFbdiDate`, `truncate`                                | CSV utilities                                                                                  |
| `deriveGroupId`                                                             | Deterministic batch key                                                                        |

### Data Extraction and UCM Files

| Export                                              | Description                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `FusionExportService`                               | `submitExport`, `findDocumentIds`, `downloadDocument`, `waitForDocuments`, `runExport`, `uploadFile` |
| `buildExportBulkDataPayload`                        | `exportBulkData` payload                                                                             |
| `buildExportFilePrefix`                             | Derives `ExportBulkData_<jobDefName>_<requestId>`                                                    |
| `buildDocumentIdsPath`                              | GET finder path for resolving UCM document ids                                                       |
| `buildGetDocumentPayload`, `buildUploadFilePayload` | Download and staging payloads                                                                        |
| `FUSION_EXTRACT_FILE_TYPES`                         | `ALL`, `CSV`, `XML`, `TEXT`, `LOG`                                                                   |
| `FUSION_NULL_VALUE`                                 | `#NULL`, required by finder parameters that are unused                                               |

### Built-in GL Journal Template

| Export                                                                 | Description                                                    |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `GL_JOURNAL_TEMPLATE`, `GL_INTERFACE_FILE`                             | Template and file definition                                   |
| `GL_INTERFACE_COLUMN_COUNT`, `REFERENCE_MAX_LENGTH`                    | 149 columns; Oracle's REFERENCE field limit                    |
| `buildGlJournalRows`, `buildGlJournalContent`                          | Journal row construction                                       |
| `buildJournalImportParameterList`                                      | Journal Import specific parameter string                       |
| `buildBatchName`, `DEFAULT_BATCH_NAME_PREFIX`                          | Batch naming                                                   |
| `GL_JOURNAL_IMPORT_JOB_OPTIONS`, `GL_JOURNAL_IMPORT_INTERFACE_DETAILS` | Suggested job options; the unverified `InterfaceDetails` value |
| `GL_AUTO_POST_JOB`                                                     | AutoPost ESS job coordinates                                   |

## Troubleshooting

**Documents submitted twice.** Write methods never retry, but your own scheduler might resend.
Derive a deterministic batch key with `deriveGroupId(sourceKey)` and check whether Fusion already
holds that batch before resending.

**Fusion reports a required field as empty after import.** Usually a misspelled column name.
`buildFbdiRow` throws on unknown names, but that protection is lost if you assemble positional
arrays yourself. The other common cause is column indexes taken from a different Fusion version's
FBDI template.

**A multi-file import fails while single-file imports work.** File names inside the archive must
match the import's `.ctl` definition exactly, including case. When `entryFileName` is wrong,
SQL\*Loader cannot find the data file and the resulting error rarely mentions the file name.

**An ESS job never finishes, or is reported as failed too early.** See the warning about `PAUSED`
above.

**The parameter list is rejected.** `buildJournalImportParameterList` is Journal Import specific.
AP and AR imports and AutoPost use different formats that must be assembled per job definition.

**404 responses are retried.** This is intentional: Fusion returns 404 briefly for resources that
are still being created. If your flow needs 404 to be terminal, for example when confirming a batch
was deleted, pass `maxRetries: 0` and inspect `error.status === 404` yourself.

**Requests hang for a long time.** The default timeout is 60 seconds. If you raise or disable it,
the worst case for an idempotent GET is `timeoutMs * (maxRetries + 1)`.

**Observability slows down business flows.** `record()` is awaited before the call returns. It must
never throw and should be fast; batch or queue writes inside your own sink if the backing store is
slow.

## Requirements

- Node.js 18 or later, for the built-in `fetch`, `Buffer` and `URLSearchParams`
- No runtime dependencies. ZIP archives are produced by a hand-rolled STORED implementation with
  CRC-32, so no compression library is required.

## Development

```bash
yarn nx test @rytass/erp-oracle-fusion    # unit tests
yarn nx lint @rytass/erp-oracle-fusion    # ESLint
yarn nx build @rytass/erp-oracle-fusion   # emit lib/ (ESM + CJS + type declarations)
```

Tests cover client behaviour (retry, timeout, error classification, instrumentation), the FBDI
engine (template validation, and multi-file archives verified by extracting them with the system
`unzip`), GL template parity against output verified on a live pod, and ESS status semantics.

## License

MIT
