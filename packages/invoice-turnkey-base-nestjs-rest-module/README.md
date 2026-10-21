# Rytass Utils - Invoice Turnkey Base NestJS REST Module

REST controller for [`@rytass/invoice-turnkey-base-nestjs-module`](../invoice-turnkey-base-nestjs-module). `forRoot` registers the base module for you. Use `forFeature` when the base module is already registered elsewhere (for example by the GraphQL module).

> Status: early development. Read the [base module](../invoice-turnkey-base-nestjs-module/README.md) first: company registration, track setup and the Turnkey platform prerequisites are documented there.

## Installation

```bash
yarn add @rytass/invoice-turnkey-base-nestjs-rest-module @nestjs/typeorm typeorm pg
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { TurnkeyBaseRestModule } from '@rytass/invoice-turnkey-base-nestjs-rest-module';

@Module({
  imports: [
    TurnkeyBaseRestModule.forRoot({
      dataPath: '/data',
      turnkeyDataSource: 'turnkey',
      secretEncryptionKey: process.env.TURNKEY_SECRET_KEY as string,
      routePrefix: 'turnkey',
      // deny by default: decide whether the caller may act for this company
      canAccessCompany: (request, companyTaxId) => request.user?.companies.includes(companyTaxId) ?? false,
    }),
  ],
})
export class AppModule {}
```

The base module options (`dataPath`, `turnkeyDataSource`, `secretEncryptionKey`, `workers`, `validation`, `notifications`, `print`) are listed in the [base module options table](../invoice-turnkey-base-nestjs-module/README.md#options). The REST module adds these:

| Option              | Default   | Meaning                                                                                                     |
| ------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `routePrefix`       | `turnkey` | First path segment of every route. Must not be empty, `/` or `.`                                            |
| `canAccessCompany`  | none      | `(request, companyTaxId) => boolean`. Without it, every company-scoped request is refused                   |
| `allowAllCompanies` | `false`   | Allow any company for any caller. Single-company internal deployments only                                  |
| `decorateRoute`     | none      | `(action: TurnkeyApiAction) => decorator[]`. Applied to each handler. See [Access control](#access-control) |

In `forRoot`, these are top-level options. In `forRootAsync`, `routePrefix` stays at the top level and the access options go under `access` (see [Async configuration](#async-configuration)).

### Access control

The access guard decides, for each company-scoped request, whether the caller may act for that company:

- `canAccessCompany(request, companyTaxId)` returns `true` to allow. The guard refuses requests with `403` when the company tax ID is malformed, when no access rule is configured ("Company access is not configured"), or when the callback returns `false` ("Cannot access this company").
- `allowAllCompanies: true` skips `canAccessCompany`. Use it only for single-company internal deployments.
- `decorateRoute(action)` returns decorators for each handler, for example a permission check. The `action` argument is a `TurnkeyApiAction` value (see [Action map](#action-map)). Without `decorateRoute` there is no per-action check, so anyone allowed for a company can also void or annul its invoices. The module logs a warning at startup in that case.

```typescript
import { SetMetadata } from '@nestjs/common';
import { TurnkeyApiAction } from '@rytass/invoice-turnkey-base-nestjs-rest-module';

TurnkeyBaseRestModule.forRoot({
  // ...core options
  canAccessCompany,
  decorateRoute: (action: TurnkeyApiAction) => [SetMetadata('turnkey-action', action)],
});
```

`SetMetadata` only attaches data; a guard in your app must read it and enforce it.

### Async configuration

`routePrefix` and `access` stay at the top level of `forRootAsync` because the route decorators are applied when the module is defined, before `useFactory` runs.

```typescript
TurnkeyBaseRestModule.forRootAsync({
  routePrefix: 'einvoice',
  access: {
    canAccessCompany: (request, companyTaxId) => request.user?.companies.includes(companyTaxId) ?? false,
  },
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    dataPath: config.getOrThrow('TURNKEY_DATA_PATH'),
    turnkeyDataSource: 'turnkey',
    secretEncryptionKey: config.getOrThrow('TURNKEY_SECRET_KEY'),
  }),
});
```

### Permissions with member-base

`@rytass/member-base-nestjs-module` is an optional peer dependency, loaded only from the `/member-base` subpath. `memberBaseAccess()` returns `access` settings whose `decorateRoute` attaches `AllowActions([[resource, action]])` to each handler. The global member-base `CasbinGuard` then checks the Casbin policy for that action.

```typescript
import { memberBaseAccess } from '@rytass/invoice-turnkey-base-nestjs-rest-module/member-base';

TurnkeyBaseRestModule.forRootAsync({
  routePrefix: 'einvoice',
  access: memberBaseAccess({
    resource: 'turnkey', // default
    // member-base has no notion of a company: decide it yourself, e.g. from the token
    canAccessCompany: (request, companyTaxId) => request.payload?.domain === companyTaxId,
    // actions: { ISSUE_INVOICE: 'issue', ... }  override individual mappings
  }),
  // ...
});
```

The mapping of each action to a member-base action is in the [Action map](#action-map). Add the matching `read`, `issue`, `void`, `annul`, `allowance`, `exchange`, `print`, `track`, `retry`, `resolve` and `company` actions to the Casbin policy for the roles that need them.

## Routes

Every route is under `/{routePrefix}/companies/{companyTaxId}`. Path parameters use the same names as the controller.

| Method | Path                                               | Action                   | Status | Notes                                                                                                                                                                                     |
| ------ | -------------------------------------------------- | ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | _(company root)_                                   | `READ_COMPANY`           | 200    | `404` when the company is not registered                                                                                                                                                  |
| PUT    | _(company root)_                                   | `MANAGE_COMPANY`         | 200    | Register or update. Body: `name`, `address?`, `routingId`, `exchangeEnabled?`, `certificateExpiresAt?`. No `Idempotency-Key`                                                              |
| PUT    | `qr-aes-key`                                       | `MANAGE_COMPANY`         | 204    | Body: `{ "aesKey": "<32 hex characters>" }`. No `Idempotency-Key`                                                                                                                         |
| POST   | `invoices`                                         | `ISSUE_INVOICE`          | 202    | Issue an invoice. `409` `EXTERNAL_ID_CONFLICT` when the `externalId` was used with different content                                                                                      |
| GET    | `invoices/:invoiceNumber`                          | `READ_INVOICE`           | 200    | Invoice with items                                                                                                                                                                        |
| GET    | `invoices?externalId=`                             | `READ_INVOICE`           | 200    | Invoice by your own order id                                                                                                                                                              |
| POST   | `invoices/:invoiceNumber/void`                     | `VOID_INVOICE`           | 202    | Body: `reason`, `remark?`. Requires `ISSUED` or `CONFIRMED`                                                                                                                               |
| POST   | `invoices/:invoiceNumber/annul`                    | `ANNUL_INVOICE`          | 202    | Annul a storage invoice (F0701). Requires `ISSUED` or `CONFIRMED`                                                                                                                         |
| POST   | `invoices/:invoiceNumber/rejection/acknowledge`    | `ACKNOWLEDGE_REJECTION`  | 202    | Acknowledge the buyer's rejection (A0302)                                                                                                                                                 |
| POST   | `invoices/:invoiceNumber/proof`                    | `PRINT_INVOICE`          | 200    | Body: `format?`, `operator?`. `format` is one of `JSON`, `PDF`, `PNG`, `ESC_POS`, `A4_PDF`. Requires `Idempotency-Key`                                                                    |
| POST   | `allowances`                                       | `ISSUE_ALLOWANCE`        | 202    | Issue an allowance against an invoice (G0401 or B0101)                                                                                                                                    |
| POST   | `allowances/:allowanceNumber/void`                 | `VOID_ALLOWANCE`         | 202    | Body: `reason`. Void an allowance (G0501 or B0201)                                                                                                                                        |
| POST   | `allowances/:allowanceNumber/proof`                | `PRINT_ALLOWANCE`        | 200    | Same body and formats as the invoice proof                                                                                                                                                |
| GET    | `invoices/:invoiceNumber/allowances`               | `READ_ALLOWANCE`         | 200    | Every allowance of the invoice, including voided ones                                                                                                                                     |
| GET    | `allowances/:allowanceNumber`                      | `READ_ALLOWANCE`         | 200    | Allowance with items                                                                                                                                                                      |
| GET    | `received-invoices?status=&limit=`                 | `READ_RECEIVED`          | 200    | Documents received as buyer. `status`: `RECEIVED`, `CONFIRMED`, `REJECTED`, `REJECTION_ACKNOWLEDGED`                                                                                      |
| GET    | `received-allowances?status=&limit=`               | `READ_RECEIVED`          | 200    | Allowances received as buyer. Same `status` values                                                                                                                                        |
| POST   | `received-invoices/:documentNumber/confirm`        | `REPLY_RECEIVED`         | 202    | Confirm the invoice (A0102). Body: see [Reply body](#reply-body)                                                                                                                          |
| POST   | `received-invoices/:documentNumber/reject`         | `REPLY_RECEIVED`         | 202    | Reject the invoice (A0301). Body: `reason` required                                                                                                                                       |
| POST   | `received-invoices/:documentNumber/void/confirm`   | `REPLY_RECEIVED`         | 202    | Confirm the seller's void request (A0202)                                                                                                                                                 |
| POST   | `received-allowances/:documentNumber/confirm`      | `REPLY_RECEIVED`         | 202    | Confirm the allowance (B0102)                                                                                                                                                             |
| POST   | `received-allowances/:documentNumber/void/confirm` | `REPLY_RECEIVED`         | 202    | Confirm the seller's allowance void (B0202)                                                                                                                                               |
| GET    | `validation/mobile-barcodes/:code`                 | `VALIDATE`               | 200    | `{ "valid": boolean }`. Format check only                                                                                                                                                 |
| GET    | `validation/npo-codes/:code`                       | `VALIDATE`               | 200    | `{ "valid": boolean }`. Format check only                                                                                                                                                 |
| POST   | `invoice-tracks`                                   | `REGISTER_INVOICE_TRACK` | 201    | Body: `period`, `track`, `beginNumber`, `endNumber`. See [Invoice tracks and periods](../invoice-turnkey-base-nestjs-module/README.md#invoice-tracks-and-periods)                         |
| POST   | `invoice-tracks/:period/blank-number-reports`      | `REPORT_BLANK_NUMBERS`   | 202    | Report the unused numbers of an ended period (E0402)                                                                                                                                      |
| POST   | `invoice-numbers/:invoiceNumber/abandon`           | `ABANDON_INVOICE_NUMBER` | 200    | Abandon a returned number                                                                                                                                                                 |
| GET    | `submissions/:submissionId`                        | `READ_SUBMISSION`        | 200    | One submission and its platform result                                                                                                                                                    |
| GET    | `submissions?status=&documentNumber=&limit=`       | `READ_SUBMISSION`        | 200    | Returns a bare array. Without `status`, returns `PENDING` and `WRITTEN`. `documentNumber` must match `^[A-Za-z0-9-]{1,16}$`                                                               |
| POST   | `submissions/:submissionId/retry`                  | `RETRY_SUBMISSION`       | 202    | Resend a `FAILED` or `REJECTED` submission with the same XML. Other statuses return `INVALID_STATE`                                                                                       |
| POST   | `submissions/:submissionId/resolve`                | `RESOLVE_SUBMISSION`     | 200    | Body: `status` (`ACCEPTED` or `FAILED`) and `reason`. See [Submissions stuck in WRITTEN](../invoice-turnkey-base-nestjs-module/README.md#submissions-stuck-in-written)                    |
| GET    | `events?after=&limit=`                             | `READ_EVENTS`            | 200    | `{ "events": [...], "nextCursor": "..." }`. `after` must be digits. `limit` 1 to 500, default 100 (`400` otherwise). See [Events](../invoice-turnkey-base-nestjs-module/README.md#events) |

### Reply body

The received-document reply routes take:

- `sellerTaxId` (required). Missing or invalid values return `422` with `INVALID_TAX_ID`. The same document number can come from different sellers.
- `documentDate` (`yyyyMMdd`). Required when the same seller sent more than one document with that number; otherwise the request fails with `INVALID_STATE` on `documentDate`.
- `reason` (required for reject).
- `remark` (optional).

## Action map

Each `TurnkeyApiAction` is passed to `decorateRoute`. `memberBaseAccess` maps it to a member-base action. The GraphQL module uses the same `TurnkeyApiAction` values for its operations ([GraphQL operations](../invoice-turnkey-base-nestjs-graphql-module/README.md#operations)).

| `TurnkeyApiAction`       | member-base action | REST routes                                                                 | GraphQL operations                                                                                                                                                             |
| ------------------------ | ------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ISSUE_INVOICE`          | `issue`            | `POST invoices`                                                             | `issueTurnkeyInvoice`                                                                                                                                                          |
| `READ_INVOICE`           | `read`             | `GET invoices/:invoiceNumber`, `GET invoices?externalId=`                   | `turnkeyInvoice`                                                                                                                                                               |
| `VOID_INVOICE`           | `void`             | `POST invoices/:invoiceNumber/void`                                         | `voidTurnkeyInvoice`                                                                                                                                                           |
| `ANNUL_INVOICE`          | `annul`            | `POST invoices/:invoiceNumber/annul`                                        | `annulTurnkeyInvoice`                                                                                                                                                          |
| `ACKNOWLEDGE_REJECTION`  | `exchange`         | `POST invoices/:invoiceNumber/rejection/acknowledge`                        | `acknowledgeTurnkeyInvoiceRejection`                                                                                                                                           |
| `ISSUE_ALLOWANCE`        | `allowance`        | `POST allowances`                                                           | `issueTurnkeyAllowance`                                                                                                                                                        |
| `VOID_ALLOWANCE`         | `allowance`        | `POST allowances/:allowanceNumber/void`                                     | `voidTurnkeyAllowance`                                                                                                                                                         |
| `READ_ALLOWANCE`         | `read`             | `GET invoices/:invoiceNumber/allowances`, `GET allowances/:allowanceNumber` | `turnkeyAllowance`, `turnkeyAllowancesByInvoice`                                                                                                                               |
| `PRINT_INVOICE`          | `print`            | `POST invoices/:invoiceNumber/proof`                                        | `printTurnkeyInvoiceProof`                                                                                                                                                     |
| `PRINT_ALLOWANCE`        | `print`            | `POST allowances/:allowanceNumber/proof`                                    | `printTurnkeyAllowanceProof`                                                                                                                                                   |
| `READ_RECEIVED`          | `read`             | `GET received-invoices`, `GET received-allowances`                          | `turnkeyReceivedInvoices`, `turnkeyReceivedAllowances`                                                                                                                         |
| `REPLY_RECEIVED`         | `exchange`         | All five `POST received-*` reply routes                                     | `confirmTurnkeyReceivedInvoice`, `rejectTurnkeyReceivedInvoice`, `confirmTurnkeyReceivedInvoiceVoid`, `confirmTurnkeyReceivedAllowance`, `confirmTurnkeyReceivedAllowanceVoid` |
| `VALIDATE`               | `read`             | `GET validation/mobile-barcodes/:code`, `GET validation/npo-codes/:code`    | none                                                                                                                                                                           |
| `REGISTER_INVOICE_TRACK` | `track`            | `POST invoice-tracks`                                                       | `registerTurnkeyInvoiceTrack`                                                                                                                                                  |
| `REPORT_BLANK_NUMBERS`   | `track`            | `POST invoice-tracks/:period/blank-number-reports`                          | `reportTurnkeyBlankNumbers`                                                                                                                                                    |
| `ABANDON_INVOICE_NUMBER` | `track`            | `POST invoice-numbers/:invoiceNumber/abandon`                               | `abandonTurnkeyInvoiceNumber`                                                                                                                                                  |
| `READ_SUBMISSION`        | `read`             | `GET submissions/:submissionId`, `GET submissions`                          | `turnkeySubmissions`                                                                                                                                                           |
| `RETRY_SUBMISSION`       | `retry`            | `POST submissions/:submissionId/retry`                                      | `retryTurnkeySubmission`                                                                                                                                                       |
| `RESOLVE_SUBMISSION`     | `resolve`          | `POST submissions/:submissionId/resolve`                                    | `resolveTurnkeySubmission`                                                                                                                                                     |
| `READ_EVENTS`            | `read`             | `GET events`                                                                | `turnkeyEvents`                                                                                                                                                                |
| `READ_COMPANY`           | `read`             | `GET` company                                                               | `turnkeyCompany`                                                                                                                                                               |
| `MANAGE_COMPANY`         | `company`          | `PUT` company, `PUT qr-aes-key`                                             | `registerTurnkeyCompany`, `setTurnkeyQrAesKey`                                                                                                                                 |

The `TurnkeyApiAction` enum has 22 values; this table lists all of them.

## Idempotency

Every `POST` route requires an `Idempotency-Key` header (1 to 255 characters, `400` when missing). That is 18 routes. `PUT` routes do not use it.

- The key is scoped to the company, the key and the action. Replies use `action:sellerTaxId:documentNumber` as the action string.
- Same key and same body: the stored response is returned, with the header `Idempotent-Replayed: true`.
- Same key and different body: `409` with `IDEMPOTENCY_KEY_REUSED`.
- Same key while the first request is still running: `409` with `IDEMPOTENCY_KEY_IN_PROGRESS`.
- Keys are kept for 7 days, and the GraphQL module shares them.

## Errors

Error responses have these shapes:

| Source                                   | Body                              | HTTP status                                                                                                                                  |
| ---------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation (`TurnkeyValidationError`)    | `{ "code", "message", "issues" }` | `404` for `INVOICE_NOT_FOUND`, `COMPANY_NOT_REGISTERED`, `SUBMISSION_NOT_FOUND`; `409` for `EXTERNAL_ID_CONFLICT`; `422` for all other codes |
| Idempotency conflict                     | `{ "code", "message" }`           | `409`                                                                                                                                        |
| Proof printing (`TurnkeyPrintError`)     | `{ "code", "message" }`           | `NOT_FOUND` `404`; `NOT_PRINTABLE` `422`; `QR_KEY_MISSING` `422`; `RENDERER_UNAVAILABLE` `501`                                               |
| Access guard                             | Nest error with message           | `403`: invalid `companyTaxId` format, "Company access is not configured", "Cannot access this company"                                       |
| Missing `Idempotency-Key`, invalid query | Nest error                        | `400`                                                                                                                                        |

The validation codes and their meanings are listed in the [base module](../invoice-turnkey-base-nestjs-module/README.md#validation-codes).
