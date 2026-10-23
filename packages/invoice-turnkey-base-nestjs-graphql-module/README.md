# Rytass Utils - Invoice Turnkey Base NestJS GraphQL Module

Code-first GraphQL resolvers for [`@rytass/invoice-turnkey-base-nestjs-module`](https://github.com/Rytass/Utils/tree/main/packages/invoice-turnkey-base-nestjs-module). `forRoot` registers the base module for you. Use `forFeature` when the base module is already registered elsewhere (for example by the REST module).

> Turnkey itself is not part of this package. See [Running Turnkey](https://github.com/Rytass/Utils/tree/main/packages/invoice-turnkey-base-nestjs-module#running-turnkey) in the base module and the [Turnkey Docker guide](https://github.com/Rytass/Utils/blob/main/docker/invoice-turnkey/README.md) for building the image and configuring Turnkey.

> Status: early development. Read the [base module](https://github.com/Rytass/Utils/blob/main/packages/invoice-turnkey-base-nestjs-module/README.md) first: company registration, track setup and the Turnkey platform prerequisites are documented there.

## Installation

```bash
yarn add @rytass/invoice-turnkey-base-nestjs-graphql-module @nestjs/graphql @nestjs/apollo @apollo/server @nestjs/typeorm graphql typeorm pg
```

The host app owns the GraphQL setup (`GraphQLModule.forRoot`). Use code-first with `autoSchemaFile`, and make sure the GraphQL context exposes the express request as `req` (Apollo's default).

**Express 5 integration package.** `@nestjs/apollo` loads `@as-integrations/express5` at runtime when the app runs on the Express platform (the default for NestJS 11). This package does not install it, so the host app must add it:

```bash
yarn add @as-integrations/express5
```

Without it, `GraphQLModule` logs `The "@as-integrations/express5" package is missing` and the GraphQL endpoint is not mounted. Fastify apps need `@as-integrations/fastify` instead. This package lists `@as-integrations/express5` as an optional peer dependency for that reason.

## Usage

```typescript
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TurnkeyBaseGraphQLModule } from '@rytass/invoice-turnkey-base-nestjs-graphql-module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({ driver: ApolloDriver, autoSchemaFile: true }),
    TurnkeyBaseGraphQLModule.forRoot({
      dataPath: '/data',
      turnkeyDataSource: 'turnkey',
      secretEncryptionKey: process.env.TURNKEY_SECRET_KEY as string,
      // deny by default: decide whether the caller may act for this company
      canAccessCompany: (request, companyTaxId) => request.user?.companies.includes(companyTaxId) ?? false,
    }),
  ],
})
export class AppModule {}
```

The base module options are listed in the [base module options table](https://github.com/Rytass/Utils/blob/main/packages/invoice-turnkey-base-nestjs-module/README.md#options).

To run REST and GraphQL in the same app, register the base once with `TurnkeyBaseRestModule.forRoot(...)` and add `TurnkeyBaseGraphQLModule.forFeature({ canAccessCompany })`, or the reverse.

## Access control

- `canAccessCompany(request, companyTaxId)` decides whether the caller may act for a company. Resolvers check it for every company argument. Without it, and without `allowAllCompanies: true` (single-company internal deployments only), the call is rejected.
- `decorateRoute(action)` returns decorators applied to each resolver method, for example permission checks. The action values are the same `TurnkeyApiAction` values as in the REST module. Each operation has its own action: `annulTurnkeyInvoice` uses `ANNUL_INVOICE`, not `VOID_INVOICE`. The full list is in the [REST action map](https://github.com/Rytass/Utils/blob/main/packages/invoice-turnkey-base-nestjs-rest-module/README.md#action-map). Without `decorateRoute` there is no per-action check, so anyone allowed for a company can also void or annul its invoices. The module logs a warning at startup in that case.

## member-base access (optional)

`@rytass/invoice-turnkey-base-nestjs-graphql-module/member-base` exports `memberBaseAccess()`, which decorates every resolver with `AllowActions([[resource, action]])` so the global member-base `CasbinGuard` checks it. This is a sub-path entry: the main entry never imports `@rytass/member-base-nestjs-module`, so apps that do not use member-base do not need it installed. The package lists it as an optional peer dependency (`^0.15.1`).

```typescript
import { memberBaseAccess } from '@rytass/invoice-turnkey-base-nestjs-graphql-module/member-base';

TurnkeyBaseGraphQLModule.forRoot({
  // ...core options
  access: memberBaseAccess({
    canAccessCompany: (request, taxId) => request.payload?.domain === taxId,
  }),
});
```

Action mapping:

| Operations                                                                                                        | member-base action |
| ----------------------------------------------------------------------------------------------------------------- | ------------------ |
| All queries except `turnkeyInvoiceTracks`; `turnkeyCompany` included                                              | `read`             |
| `registerTurnkeyCompany`, `setTurnkeyQrAesKey`                                                                    | `company`          |
| `issueTurnkeyInvoice`                                                                                             | `issue`            |
| `voidTurnkeyInvoice`                                                                                              | `void`             |
| `annulTurnkeyInvoice` (authorized separately from void)                                                           | `annul`            |
| `issueTurnkeyAllowance`, `voidTurnkeyAllowance`                                                                   | `allowance`        |
| `acknowledgeTurnkeyInvoiceRejection`, the five `*ReceivedInvoice*` / `*ReceivedAllowance*` reply mutations        | `exchange`         |
| `printTurnkeyInvoiceProof`, `printTurnkeyAllowanceProof`                                                          | `print`            |
| `turnkeyInvoiceTracks`, `registerTurnkeyInvoiceTrack`, `reportTurnkeyBlankNumbers`, `abandonTurnkeyInvoiceNumber` | `track`            |
| `retryTurnkeySubmission`                                                                                          | `retry`            |
| `resolveTurnkeySubmission`                                                                                        | `resolve`          |

Override individual actions with `actions`. `canAccessCompany` is supplied by the host. Without it, and without `allowAllCompanies`, every company is denied.

`forRootAsync` follows the same rule as REST: core options come from `useFactory`, and `access` stays at the top level because resolver decorators are applied when the class is defined.

```typescript
TurnkeyBaseGraphQLModule.forRootAsync({
  access: memberBaseAccess({ canAccessCompany }),
  useFactory: () => ({
    dataPath: '/data',
    turnkeyDataSource: 'turnkey',
    secretEncryptionKey: process.env.TURNKEY_SECRET_KEY as string,
  }),
});
```

## Operations

The module exposes 31 operations: 11 queries and 20 mutations. Every operation takes `companyTaxId` as its first argument. Check the generated `schema.gql` for the other argument names and input types.

| Kind     | Operation                             | Action                   | `idempotencyKey` |
| -------- | ------------------------------------- | ------------------------ | ---------------- |
| Query    | `turnkeyCompany`                      | `READ_COMPANY`           | no               |
| Query    | `turnkeyInvoice`                      | `READ_INVOICE`           | no               |
| Query    | `turnkeyInvoices`                     | `READ_INVOICE`           | no               |
| Query    | `turnkeyAllowance`                    | `READ_ALLOWANCE`         | no               |
| Query    | `turnkeyAllowances`                   | `READ_ALLOWANCE`         | no               |
| Query    | `turnkeyAllowancesByInvoice`          | `READ_ALLOWANCE`         | no               |
| Query    | `turnkeyInvoiceTracks`                | `READ_INVOICE_TRACK`     | no               |
| Query    | `turnkeySubmissions`                  | `READ_SUBMISSION`        | no               |
| Query    | `turnkeyEvents`                       | `READ_EVENTS`            | no               |
| Query    | `turnkeyReceivedInvoices`             | `READ_RECEIVED`          | no               |
| Query    | `turnkeyReceivedAllowances`           | `READ_RECEIVED`          | no               |
| Mutation | `registerTurnkeyCompany`              | `MANAGE_COMPANY`         | no               |
| Mutation | `setTurnkeyQrAesKey`                  | `MANAGE_COMPANY`         | no               |
| Mutation | `issueTurnkeyInvoice`                 | `ISSUE_INVOICE`          | yes              |
| Mutation | `voidTurnkeyInvoice`                  | `VOID_INVOICE`           | yes              |
| Mutation | `annulTurnkeyInvoice`                 | `ANNUL_INVOICE`          | yes              |
| Mutation | `acknowledgeTurnkeyInvoiceRejection`  | `ACKNOWLEDGE_REJECTION`  | yes              |
| Mutation | `printTurnkeyInvoiceProof`            | `PRINT_INVOICE`          | yes              |
| Mutation | `issueTurnkeyAllowance`               | `ISSUE_ALLOWANCE`        | yes              |
| Mutation | `voidTurnkeyAllowance`                | `VOID_ALLOWANCE`         | yes              |
| Mutation | `printTurnkeyAllowanceProof`          | `PRINT_ALLOWANCE`        | yes              |
| Mutation | `registerTurnkeyInvoiceTrack`         | `REGISTER_INVOICE_TRACK` | yes              |
| Mutation | `reportTurnkeyBlankNumbers`           | `REPORT_BLANK_NUMBERS`   | yes              |
| Mutation | `abandonTurnkeyInvoiceNumber`         | `ABANDON_INVOICE_NUMBER` | yes              |
| Mutation | `retryTurnkeySubmission`              | `RETRY_SUBMISSION`       | yes              |
| Mutation | `resolveTurnkeySubmission`            | `RESOLVE_SUBMISSION`     | yes              |
| Mutation | `confirmTurnkeyReceivedInvoice`       | `REPLY_RECEIVED`         | yes              |
| Mutation | `rejectTurnkeyReceivedInvoice`        | `REPLY_RECEIVED`         | yes              |
| Mutation | `confirmTurnkeyReceivedInvoiceVoid`   | `REPLY_RECEIVED`         | yes              |
| Mutation | `confirmTurnkeyReceivedAllowance`     | `REPLY_RECEIVED`         | yes              |
| Mutation | `confirmTurnkeyReceivedAllowanceVoid` | `REPLY_RECEIVED`         | yes              |

Two arguments are worth knowing: `resolveTurnkeySubmission(companyTaxId, submissionId, status, reason, idempotencyKey)` takes `status` as `ACCEPTED` or `FAILED` (other values fail with `INVALID_STATE`), and `printTurnkeyInvoiceProof` and `printTurnkeyAllowanceProof` take `(companyTaxId, invoiceNumber | allowanceNumber, idempotencyKey)`. The REST routes for each operation are listed in the [REST action map](https://github.com/Rytass/Utils/blob/main/packages/invoice-turnkey-base-nestjs-rest-module/README.md#action-map).

**Lists.** `turnkeyInvoices`, `turnkeyAllowances` and `turnkeyInvoiceTracks` back list pages:

- `turnkeyInvoices(companyTaxId, status?, period?, buyerTaxId?, invoiceNumber?, limit?, offset?)` returns `{ id, total, items }`. Items are `TurnkeyInvoiceSummary`, without line items, newest first.
  - `period` (for example `11510`) matches the issue time in Taipei time.
  - `deliveryMode` tells storage (`STORAGE`, F0401) from exchange (`EXCHANGE`, A0101).
  - `lastSubmissionStatus` is the status of the invoice's latest submission (issue, void or annul). `lastErrorCode` and `lastErrorMessage` are set only when that submission was `REJECTED` or `FAILED`, so they clear once a retry is accepted.
- `turnkeyAllowances(companyTaxId, status?, invoiceNumber?, limit?, offset?)` returns `TurnkeyAllowanceSummary` items in the same shape. `invoiceNumber` is the original invoice.
- `turnkeyInvoiceTracks(companyTaxId, period?)` returns every registered track, newest period first. `remaining` counts the unused numbers of the whole period, as `registerTurnkeyInvoiceTrack` does, and `trackRemaining` counts those of that track.
- `limit` defaults to 100 and is clamped to 1–500. `offset` defaults to 0. `total` ignores both.
- A malformed `period` fails with `BAD_USER_INPUT`.
- The summary types are separate from `TurnkeyInvoice` and `TurnkeyAllowance`, so a list never overwrites a cached detail. Refetch the list after a mutation that changes an invoice or allowance.

**Submissions.** `turnkeySubmissions` returns `{ items }`. Without `status` it returns `PENDING` and `WRITTEN` submissions. There is no single-submission query in GraphQL. Use REST `GET submissions/:submissionId`, or read the `submission.*` events.

**Events.** `turnkeyEvents` takes the `after` cursor. Its `limit` is clamped silently to 1 to 500, unlike REST, which returns `400`. See [Events](https://github.com/Rytass/Utils/blob/main/packages/invoice-turnkey-base-nestjs-module/README.md#events).

**Received documents.** The received-document queries take `status` and `limit`. The reply mutations take `sellerTaxId` (required, because the same document number can come from different sellers) and `documentDate` (`yyyyMMdd`), which is required when the same seller sent that number more than once. See [Inbound replies](https://github.com/Rytass/Utils/blob/main/packages/invoice-turnkey-base-nestjs-module/README.md#inbound-replies).

## Object IDs

Every object type has `id: ID!`, so Apollo Client can normalize its cache:

| Type                                               | `id`                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `TurnkeyCompany`                                   | The tax ID                                                                                       |
| `TurnkeyEvent`                                     | The event sequence (the same value as the `after` cursor)                                        |
| `TurnkeyBlankNumberReport`                         | The `submissionId` of the E0402 submission for that track                                        |
| `TurnkeyBlankNumberRange`                          | `<submissionId>:<begin>-<end>`                                                                   |
| `TurnkeySubmissionCollection`                      | `turnkeySubmissions:<companyTaxId>:<status>:<documentNumber>:<limit>`                            |
| `TurnkeyEventCollection`                           | `turnkeyEvents:<companyTaxId>:<after>:<limit>`                                                   |
| `TurnkeyInvoiceCollection`                         | `turnkeyInvoices:<companyTaxId>:<status>:<period>:<buyerTaxId>:<invoiceNumber>:<limit>:<offset>` |
| `TurnkeyAllowanceCollection`                       | `turnkeyAllowances:<companyTaxId>:<status>:<invoiceNumber>:<limit>:<offset>`                     |
| `TurnkeyInvoiceSummary`, `TurnkeyAllowanceSummary` | The invoice's or allowance's own `id`                                                            |
| Other types                                        | The entity's own `id`                                                                            |

The collection ids are built from the effective query arguments, so the same query maps to the same cache entry and a refetch replaces it:

- `<status>` is `PENDING` when you omit it and list without `documentNumber`, because that is what the query returns. With `documentNumber` and no `status`, it is empty.
- `<limit>` is the limit the query applied, clamped to 1–500. `<offset>` is never below 0.
- Omitted arguments are empty strings.

## Idempotency

18 mutations require an `idempotencyKey` (1 to 255 characters). The two company mutations, `registerTurnkeyCompany` and `setTurnkeyQrAesKey`, do not. The keys are shared with the REST module and scoped to the company, the key and the action.

- Same key and same input: the first result is returned.
- Same key and different input: `IDEMPOTENCY_KEY_REUSED`.
- Same key while the first request is running: `IDEMPOTENCY_KEY_IN_PROGRESS`.
- A missing or invalid key: `IDEMPOTENCY_KEY_REQUIRED`.
- Keys are kept for 7 days.

## Proof (證明聯)

`printTurnkeyInvoiceProof(companyTaxId, invoiceNumber, idempotencyKey)` and `printTurnkeyAllowanceProof(companyTaxId, allowanceNumber, idempotencyKey)` return the base module's proof data as JSON (`TurnkeyJSON` scalar). GraphQL returns JSON only. PDF, PNG, ESC/POS and A4 PDF output is available through the REST proof routes ([REST routes](https://github.com/Rytass/Utils/blob/main/packages/invoice-turnkey-base-nestjs-rest-module/README.md#routes)).

- Each print is logged in `turnkey_print_logs`. Prints after the first are marked 補印 (see [Proof printing](https://github.com/Rytass/Utils/blob/main/packages/invoice-turnkey-base-nestjs-module/README.md#proof-printing)).
- Use the same `idempotencyKey` for a retry, so a network retry does not create a second print. Use a new key for a deliberate reprint.
- The company needs a QR AES key, or the call fails with `QR_KEY_MISSING`. Set it with `setTurnkeyQrAesKey(companyTaxId, aesKey)`. The value is stored encrypted and is never returned.
- Access uses the `PRINT_INVOICE` and `PRINT_ALLOWANCE` actions. member-base maps both to `print`.

## Errors

Validation failures from the base module are returned as GraphQL errors. `extensions.code` holds the base validation code, so clients can branch on it. `extensions.field` and `extensions.issues` are set when the base module provides them.

| `extensions.code`             | Meaning                                                                       | REST status (for reference) |
| ----------------------------- | ----------------------------------------------------------------------------- | --------------------------- |
| `EXTERNAL_ID_CONFLICT`        | The `externalId` was already used with different content                      | 409                         |
| `SUBMISSION_NOT_FOUND`        | The submission id does not exist, or is not a UUID                            | 404                         |
| `INVOICE_NOT_FOUND`           | The invoice number does not exist                                             | 404                         |
| `COMPANY_NOT_REGISTERED`      | The company has not been registered                                           | 404                         |
| `NOT_FOUND`                   | The invoice or allowance to print does not exist                              | 404                         |
| `NOT_PRINTABLE`               | The document cannot be printed                                                | 422                         |
| `QR_KEY_MISSING`              | The company has no QR AES key                                                 | 422                         |
| `RENDERER_UNAVAILABLE`        | A PDF or PNG renderer or the font is not available                            | 501                         |
| `IDEMPOTENCY_KEY_REUSED`      | The same key was used with different input                                    | 409                         |
| `IDEMPOTENCY_KEY_IN_PROGRESS` | The first request with this key has not finished                              | 409                         |
| `IDEMPOTENCY_KEY_REQUIRED`    | The `idempotencyKey` is missing or invalid                                    | 400                         |
| `BAD_USER_INPUT`              | An argument is malformed; `extensions.field` names it                         | n/a                         |
| Other validation codes        | Input or state rejected, for example `TAX_AMOUNT_MISMATCH` or `INVALID_STATE` | 422                         |

The validation codes are listed in the [base module](https://github.com/Rytass/Utils/blob/main/packages/invoice-turnkey-base-nestjs-module/README.md#validation-codes).
