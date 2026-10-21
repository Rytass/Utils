# Rytass Utils - Invoice Turnkey Base NestJS REST Module

REST controller for [`@rytass/invoice-turnkey-base-nestjs-module`](../invoice-turnkey-base-nestjs-module). `forRoot` registers the base module for you; use `forFeature` when the base module is already registered elsewhere (for example by the GraphQL module).

> Status: early development (0.x).

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
      environment: 'TEST',
      secretEncryptionKey: process.env.TURNKEY_SECRET_KEY as string,
      routePrefix: 'turnkey',
      // deny by default: decide whether the caller may act for this company
      canAccessCompany: (request, companyTaxId) => request.user?.companies.includes(companyTaxId) ?? false,
    }),
  ],
})
export class AppModule {}
```

`canAccessCompany` only decides which companies a caller may act for. Without `decorateRoute` there is no per-action check, so anyone allowed for a company can also void or annul its invoices; the module logs a warning at startup in that case.

Without `canAccessCompany` every request is rejected with 403, unless `allowAllCompanies: true` is set (single-company internal deployments only). `decorateRoute(action)` lets you attach extra decorators, such as permission checks, to each handler.

### Async configuration

`routePrefix` and `access` stay at the top level because the route decorators are applied when the module is defined, before `useFactory` runs.

```typescript
TurnkeyBaseRestModule.forRootAsync({
  routePrefix: 'einvoice',
  access: { canAccessCompany: (request, companyTaxId) => request.user?.companies.includes(companyTaxId) ?? false },
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    dataPath: config.getOrThrow('TURNKEY_DATA_PATH'),
    turnkeyDataSource: 'turnkey',
    environment: 'PRODUCTION',
    secretEncryptionKey: config.getOrThrow('TURNKEY_SECRET_KEY'),
  }),
});
```

### Permissions with member-base

`@rytass/member-base-nestjs-module` is an optional peer dependency, loaded only when you import the `/member-base` subpath. `memberBaseAccess()` decorates every handler with `AllowActions([[resource, action]])` for member-base's global `CasbinGuard`: queries use `read`, and `issue`, `void`, `annul`, `allowance`, `exchange`, `print`, `track` and `retry` are separate actions, so a Casbin policy can grant them one by one (override them with `actions`).

```typescript
import { memberBaseAccess } from '@rytass/invoice-turnkey-base-nestjs-rest-module/member-base';

TurnkeyBaseRestModule.forRootAsync({
  routePrefix: 'einvoice',
  access: memberBaseAccess({
    resource: 'turnkey',
    // member-base has no notion of a company: decide it yourself, e.g. from the token domain
    canAccessCompany: (request, companyTaxId) => request.payload?.domain === companyTaxId,
  }),
  // ...
});
```

## Routes

All routes are under `/{routePrefix}/companies/{companyTaxId}`. Every `POST` requires an `Idempotency-Key` header: a retry with the same key and body returns the first result (`Idempotent-Replayed: true`), the same key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`, and keys are kept for 7 days.

| Method | Path                                                  | Result                                                                                                                                                   |
| ------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/invoices`                                           | `202` with the invoice; `422` validation, `409` `externalId` reused                                                                                      |
| GET    | `/invoices/{invoiceNumber}`                           | Invoice with items                                                                                                                                       |
| GET    | `/invoices?externalId=`                               | Invoice by your own order id                                                                                                                             |
| POST   | `/invoices/{invoiceNumber}/void`                      | Void (`reason`, `remark`); F0501, or A0201 for exchange invoices                                                                                         |
| POST   | `/invoices/{invoiceNumber}/annul`                     | Annul a storage invoice (F0701, system errors only; `reason` required)                                                                                   |
| POST   | `/invoices/{invoiceNumber}/rejection/acknowledge`     | Acknowledge a buyer's rejection (A0302)                                                                                                                  |
| POST   | `/allowances`                                         | Issue an allowance against an invoice (G0401 / B0101)                                                                                                    |
| POST   | `/invoices/{invoiceNumber}/proof`                     | Print a proof: body `{ format, operator }`, `JSON` data or a `PDF` / `A4_PDF` / `PNG` / `ESC_POS` file; a retry with the same key returns the same print |
| POST   | `/allowances/{allowanceNumber}/proof`                 | Print an allowance proof, same body and formats                                                                                                          |
| GET    | `/invoices/{invoiceNumber}/allowances`                | All allowances of an invoice, including voided ones                                                                                                      |
| GET    | `/allowances/{allowanceNumber}`                       | Allowance with items                                                                                                                                     |
| POST   | `/allowances/{allowanceNumber}/void`                  | Void an allowance (G0501 / B0201)                                                                                                                        |
| GET    | `/received-invoices?status=`                          | Exchange invoices and void requests received as buyer                                                                                                    |
| POST   | `/received-invoices/{invoiceNumber}/confirm`          | Confirm a received invoice (A0102)                                                                                                                       |
| POST   | `/received-invoices/{invoiceNumber}/reject`           | Reject a received invoice (A0301, `reason` required)                                                                                                     |
| POST   | `/received-invoices/{invoiceNumber}/void/confirm`     | Confirm the seller's void request (A0202)                                                                                                                |
| GET    | `/received-allowances?status=`                        | Exchange allowances and void requests received as buyer                                                                                                  |
| POST   | `/received-allowances/{allowanceNumber}/confirm`      | Confirm a received allowance (B0102)                                                                                                                     |
| POST   | `/received-allowances/{allowanceNumber}/void/confirm` | Confirm the seller's allowance void (B0202)                                                                                                              |
| GET    | `/validation/mobile-barcodes/{code}`                  | `{ valid }`, format check only                                                                                                                           |
| GET    | `/validation/npo-codes/{code}`                        | `{ valid }`, format check only                                                                                                                           |
| POST   | `/invoice-tracks`                                     | Register a track range (`period`, `track`, `beginNumber`, `endNumber`)                                                                                   |
| POST   | `/invoice-tracks/{period}/blank-number-reports`       | Report unused numbers of an ended period (E0402)                                                                                                         |
| POST   | `/invoice-numbers/{invoiceNumber}/abandon`            | Give up a `RETURNED` number so it is reported blank                                                                                                      |
| GET    | `/submissions/{submissionId}`                         | One MIG submission and its platform result                                                                                                               |
| POST   | `/submissions/{submissionId}/retry`                   | Resend a `FAILED` / `REJECTED` submission with the same XML                                                                                              |
| GET    | `/submissions?status=PENDING`                         | Submissions by status                                                                                                                                    |
| GET    | `/events?after={cursor}&limit=`                       | Event outbox page and `nextCursor`                                                                                                                       |

The received-document reply routes need `sellerTaxId` in the body: the same number can come from different sellers, and a seller's numbers repeat across periods. Pass `documentDate` (`yyyyMMdd`) as well when the same seller sent that number more than once; without it the request fails with `INVALID_STATE` on `documentDate`. The idempotency scope is the action, seller and number. If the platform rejects a reply, the document goes back to `RECEIVED`: reply again (for example reject instead of confirm), or resend the same reply with `/submissions/{submissionId}/retry`, which is refused once the document has been answered another way.
