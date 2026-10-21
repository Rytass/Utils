# Rytass Utils - Invoice Turnkey Base NestJS GraphQL Module

Code-first GraphQL resolvers for [`@rytass/invoice-turnkey-base-nestjs-module`](../invoice-turnkey-base-nestjs-module). `forRoot` registers the base module for you; use `forFeature` when the base module is already registered elsewhere (for example by the REST module).

> Status: early development (0.x).

## Installation

```bash
yarn add @rytass/invoice-turnkey-base-nestjs-graphql-module @nestjs/graphql @nestjs/apollo @apollo/server @nestjs/typeorm graphql typeorm pg
```

The host app owns the GraphQL setup (`GraphQLModule.forRoot`). Use code-first with `autoSchemaFile` and make sure the GraphQL context exposes the express request as `req` (Apollo's default).

**Express 5 integration package.** `@nestjs/apollo` loads `@as-integrations/express5` at runtime when the app runs on the Express platform (the default for NestJS 11). It is not installed by this package, so the host app must add it:

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
      environment: 'TEST',
      secretEncryptionKey: process.env.TURNKEY_SECRET_KEY as string,
      // deny by default: decide whether the caller may act for this company
      canAccessCompany: (request, companyTaxId) => request.user?.companies.includes(companyTaxId) ?? false,
    }),
  ],
})
export class AppModule {}
```

Running REST and GraphQL in the same app: register the base once with `TurnkeyBaseRestModule.forRoot(...)` and add `TurnkeyBaseGraphQLModule.forFeature({ canAccessCompany })` (or the reverse).

## Access control

- `canAccessCompany(request, companyTaxId)` decides whether the caller may act for a company. It is checked in every resolver. Without it, every call is rejected with `FORBIDDEN`, unless `allowAllCompanies: true` is set (single-company internal deployments only).
- `decorateRoute(action)` returns decorators applied to each resolver method, for example permission checks. The action values match the REST module's `TurnkeyApiAction`. Each operation has its own action; for example, `annulTurnkeyInvoice` uses `ANNUL_INVOICE`, not `VOID_INVOICE`. Without `decorateRoute` there is no per-action check, so anyone allowed for a company can also void or annul its invoices; the module logs a warning at startup in that case.

## member-base access (optional)

`@rytass/invoice-turnkey-base-nestjs-graphql-module/member-base` exports `memberBaseAccess()`, which decorates every resolver with `AllowActions([[resource, action]])` so the global member-base CasbinGuard checks it. This is a sub-path entry: the main entry never imports `@rytass/member-base-nestjs-module`, so apps that do not use member-base do not need it installed. The package lists it as an optional peer dependency (`^0.15.1`).

```typescript
import { memberBaseAccess } from '@rytass/invoice-turnkey-base-nestjs-graphql-module/member-base';

TurnkeyBaseGraphQLModule.forRoot({
  // ...core options
  access: memberBaseAccess({
    canAccessCompany: (request, taxId) => request.payload?.domain === taxId,
  }),
});
```

Action mapping: queries use `read`; `issueTurnkeyInvoice` uses `issue`; `voidTurnkeyInvoice` uses `void`; `annulTurnkeyInvoice` uses `annul` (authorized separately from void); `issueTurnkeyAllowance` and `voidTurnkeyAllowance` use `allowance`; `acknowledgeTurnkeyInvoiceRejection` and the received-document confirm/reject mutations use `exchange`; track registration, blank-number reporting and number abandonment use `track`; `retryTurnkeySubmission` uses `retry`. Override individual actions with `actions`.

`canAccessCompany` is supplied by the host. Without it, and without `allowAllCompanies`, every company is denied.

`forRootAsync` follows the same rule as REST: Core options come from `useFactory`, and `access` stays at the top level because resolver decorators are applied when the class is defined.

```typescript
TurnkeyBaseGraphQLModule.forRootAsync({
  access: memberBaseAccess({ canAccessCompany }),
  useFactory: () => ({
    dataPath: '/data',
    turnkeyDataSource: 'turnkey',
    environment: 'TEST',
    secretEncryptionKey: process.env.TURNKEY_SECRET_KEY as string,
  }),
});
```

## Operations

Every mutation requires an `idempotencyKey` (1 to 255 characters). A retry with the same key and input returns the first result; the same key with different input fails with `IDEMPOTENCY_KEY_REUSED`. Keys are shared with the REST module.

| Type     | Field                                 | Returns                                                 |
| -------- | ------------------------------------- | ------------------------------------------------------- |
| Query    | `turnkeyInvoice`                      | `TurnkeyInvoice` or `null`                              |
| Query    | `turnkeyAllowance`                    | `TurnkeyAllowance` or `null`                            |
| Query    | `turnkeyAllowancesByInvoice`          | `[TurnkeyAllowance!]!` for an invoice number            |
| Query    | `turnkeySubmissions`                  | `TurnkeySubmissionCollection`                           |
| Query    | `turnkeyEvents`                       | `TurnkeyEventCollection`                                |
| Query    | `turnkeyReceivedInvoices`             | `[TurnkeyReceivedDocument!]!` (we are the buyer)        |
| Query    | `turnkeyReceivedAllowances`           | `[TurnkeyReceivedDocument!]!` (we are the buyer)        |
| Mutation | `printTurnkeyInvoiceProof`            | `JSON` (invoice proof; counts as a print, see below)    |
| Mutation | `printTurnkeyAllowanceProof`          | `JSON` (allowance proof; counts as a print, see below)  |
| Mutation | `issueTurnkeyInvoice`                 | `TurnkeyInvoice` (`SUBMITTED`)                          |
| Mutation | `voidTurnkeyInvoice`                  | `TurnkeyInvoice`                                        |
| Mutation | `annulTurnkeyInvoice`                 | `TurnkeyInvoice` (annulment, separate action from void) |
| Mutation | `acknowledgeTurnkeyInvoiceRejection`  | `TurnkeyInvoice`                                        |
| Mutation | `issueTurnkeyAllowance`               | `TurnkeyAllowance`                                      |
| Mutation | `voidTurnkeyAllowance`                | `TurnkeyAllowance`                                      |
| Mutation | `registerTurnkeyInvoiceTrack`         | `TurnkeyInvoiceTrack` (with `remaining`)                |
| Mutation | `reportTurnkeyBlankNumbers`           | `[TurnkeyBlankNumberReport!]!` for a closed period      |
| Mutation | `abandonTurnkeyInvoiceNumber`         | `TurnkeyInvoiceNumber` (`RETURNED` to `ABANDONED`)      |
| Mutation | `retryTurnkeySubmission`              | `TurnkeySubmission`                                     |
| Mutation | `confirmTurnkeyReceivedInvoice`       | `TurnkeyReceivedDocument`                               |
| Mutation | `rejectTurnkeyReceivedInvoice`        | `TurnkeyReceivedDocument` (`reason` required)           |
| Mutation | `confirmTurnkeyReceivedInvoiceVoid`   | `TurnkeyReceivedDocument`                               |
| Mutation | `confirmTurnkeyReceivedAllowance`     | `TurnkeyReceivedDocument`                               |
| Mutation | `confirmTurnkeyReceivedAllowanceVoid` | `TurnkeyReceivedDocument`                               |

`turnkeySubmissions` returns submissions without a platform result unless `status` is given. `turnkeyEvents` takes the `after` cursor and returns `nextCursor`. The received-document queries and reply mutations take an optional `status` or `input`, and their inputs omit `xml`. Reply mutations require `sellerTaxId` (the same number can come from different sellers) and accept `documentDate` (`yyyyMMdd`), which is required when the same seller sent that number more than once. A received document never exposes the raw XML.

## Proof (證明聯)

`printTurnkeyInvoiceProof(companyTaxId, invoiceNumber, idempotencyKey)` and `printTurnkeyAllowanceProof(companyTaxId, allowanceNumber, idempotencyKey)` return the base module's `TurnkeyInvoiceProof` / `TurnkeyAllowanceProof` as JSON (`TurnkeyJSON` scalar). GraphQL only returns JSON; PDF, PNG and ESC/POS output stay in the REST module.

- **Side effect:** every print writes a `turnkey_print_logs` row, and `printCount` increases. The second and later prints return `reprint: true`, which the proof marks as 補印. That is why these are mutations.
- **Idempotency:** a retry with the same `idempotencyKey` returns the same print (same `printCount`, no new log row), so a network retry never turns the first copy into a reprint. Use a new key for a deliberate reprint.
- Only printable documents succeed: an invoice must be `printed: true` and in `SUBMITTED`, `ISSUED` or `CONFIRMED`, and not voided or annulled. Carrier invoices are `printed: false`, so they return `NOT_PRINTABLE`.
- The company needs a QR Code AES key (set with `TurnkeyCompanyService.setQrAesKey`, not through GraphQL), or the call returns `QR_KEY_MISSING`.
- Access uses the `PRINT_INVOICE` / `PRINT_ALLOWANCE` actions. member-base maps both to `print`.

## Errors

Validation failures from the base module are returned as GraphQL errors with `extensions.code` set to the base validation code, plus `extensions.field` and `extensions.issues`. The domain code is kept as-is so clients can branch on it.

| `extensions.code`             | Meaning                                                    | REST equivalent |
| ----------------------------- | ---------------------------------------------------------- | --------------- |
| `EXTERNAL_ID_CONFLICT`        | The `externalId` was already used for a different invoice  | 409             |
| `SUBMISSION_NOT_FOUND`        | The submission id does not exist (or is not a UUID)        | 404             |
| `INVOICE_NOT_FOUND`           | The invoice number does not exist                          | 404             |
| `COMPANY_NOT_REGISTERED`      | The company has not been registered                        | 404             |
| `NOT_FOUND`                   | The invoice or allowance to print does not exist           | 404             |
| `NOT_PRINTABLE`               | The document cannot be printed (carrier, voided, rejected) | 422             |
| `QR_KEY_MISSING`              | The company has no QR Code AES key                         | 422             |
| `RENDERER_UNAVAILABLE`        | Only for PDF/PNG renderers; JSON proofs never return it    | 501             |
| `IDEMPOTENCY_KEY_REUSED`      | The same key was used with different input                 | 409             |
| `IDEMPOTENCY_KEY_IN_PROGRESS` | The first request with this key has not finished           | 409             |
| Other validation codes        | Input or state rejected, for example `TAX_AMOUNT_MISMATCH` | 422             |

Other errors: a missing or invalid `idempotencyKey` uses `IDEMPOTENCY_KEY_REQUIRED`, an invalid date or cursor uses `BAD_USER_INPUT`, and a caller without access gets `FORBIDDEN`.
