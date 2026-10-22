# Rytass Utils - Invoice Turnkey Base NestJS Module

NestJS base module for issuing Taiwan e-invoices through the MOF e-Invoice **Turnkey** appliance (no value-added center). The app runs next to a Turnkey container, shares its `/data` volume, writes MIG 4.1 XML into `UpCast`, and reads results from Turnkey's own database.

> Status: early development. Verify each flow against the MOF test platform before production use.

## Features

- [x] Input validation without a database: amounts, tax ID checksum, carrier and donation formats, print mark, zero-rated fields, upload deadline
- [x] MIG 4.1 XML for F0401, F0501, F0701, G0401, G0501, A0101–A0302, B0101–B0202 and E0402
- [x] Invoice track registration and serialized number allocation
- [x] Atomic XML write into `UpCast/<category>/<message>/SRC/`
- [x] Result polling from Turnkey's log tables (`turnkey_message_log_detail`, `turnkey_message_log`, `turnkey_sysevent_log`)
- [x] Event outbox (`turnkey_events`) with a cursor, plus NATS and Redis notify packages
- [x] Void, annulment (storage invoices), allowance and allowance void
- [x] Exchange (B2B): buyer confirm, reject and void-confirm replies, rejection acknowledgement
- [x] Inbound scan of `RecvTarget/<message>/*.xml`, with archiving
- [x] Submission retry with the same XML, manual resolution of stalled submissions, blank-number report, number abandonment
- [x] Daily reconciliation of `SummaryResult` files
- [x] Proof printing: 1D barcode and QR codes; PDF, PNG, ESC/POS and A4 PDF renderers

## Prerequisites

This module does not install or configure Turnkey. Get the platform side ready before the first issue. The [Docker guide](../../docker/invoice-turnkey/README.md) describes each step:

- Turnkey 3.2.x runs next to the app and shares its `/data` volume ([overview](../../docker/invoice-turnkey/README.md#1-overview), [volume layout](../../docker/invoice-turnkey/README.md#61-the-volume)).
- The fixed egress IP is registered ([2.1](../../docker/invoice-turnkey/README.md#21-register-the-fixed-egress-ip)).
- The master certificate and the software certificate are registered ([2.2](../../docker/invoice-turnkey/README.md#22-register-a-master-certificate), [2.3](../../docker/invoice-turnkey/README.md#23-create-a-software-certificate-and-register-it)).
- Invoice tracks are allocated ([2.4](../../docker/invoice-turnkey/README.md#24-allocate-invoice-tracks)) and the pre-launch self-test passes ([2.5](../../docker/invoice-turnkey/README.md#25-pre-launch-self-test)).
- The four Turnkey schedules exist ([5.3](../../docker/invoice-turnkey/README.md#53-schedules-four-tasks-are-required), see [Background workers](#background-workers)).
- The app has the read-only database role ([4.3](../../docker/invoice-turnkey/README.md#43-give-the-app-a-read-only-role), see [Turnkey database access](#turnkey-database-access)).
- Each seller is registered in this module ([Company registration](#company-registration)).

## Installation

```bash
yarn add @rytass/invoice-turnkey-base-nestjs-module @nestjs/typeorm typeorm pg
```

## Basic Usage

```typescript
import { Injectable, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TurnkeyBaseModule,
  TurnkeyDeliveryMode,
  TurnkeyInvoiceService,
  TurnkeyTaxType,
} from '@rytass/invoice-turnkey-base-nestjs-module';

@Module({
  imports: [
    // the app's own database (the turnkey_* tables live here)
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
    }),
    // Turnkey's database, connected with the read-only role
    TypeOrmModule.forRoot({
      name: 'turnkey',
      type: 'postgres',
      url: process.env.TURNKEY_DATABASE_URL,
    }),
    TurnkeyBaseModule.forRoot({
      dataPath: '/data',
      turnkeyDataSource: 'turnkey',
      secretEncryptionKey: process.env.TURNKEY_SECRET_KEY as string,
    }),
  ],
})
export class AppModule {}

@Injectable()
export class OrderInvoiceService {
  constructor(private readonly turnkeyInvoiceService: TurnkeyInvoiceService) {}

  issueForOrder(orderId: string) {
    return this.turnkeyInvoiceService.issue({
      companyTaxId: '12345675', // the seller must be registered first
      deliveryMode: TurnkeyDeliveryMode.STORAGE,
      externalId: orderId, // your own order id; reusing it with different content fails with EXTERNAL_ID_CONFLICT
      // with buyer.taxId this is a B2B invoice (unitPrice is tax-exclusive); omit buyer for B2C (tax-inclusive price)
      buyer: { taxId: '87654322', name: '測試營業人' },
      items: [
        {
          description: 'Monthly pass',
          quantity: 1,
          unitPrice: 1280,
          taxType: TurnkeyTaxType.TAXABLE,
        },
      ],
    });
  }
}
```

`issue()` validates the input, reserves a number and stores the invoice as `SUBMITTED`. The worker writes the XML and later moves the invoice to `ISSUED` or `FAILED`. Poll the invoice, or listen to events, to learn the outcome.

## Options

`TurnkeyBaseModule.forRoot(options)` (and `forRootAsync`). The defaults below are the values used in code when an option is omitted.

| Option                                          | Default                      | Meaning                                                                                                                |
| ----------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `dataPath`                                      | required                     | Turnkey's `/data` volume, shared with the app                                                                          |
| `turnkeyDataSource`                             | required                     | TypeORM connection name (or `DataSource`) for Turnkey's database; use the read-only role                               |
| `secretEncryptionKey`                           | required                     | Encrypts stored secrets. See [Secret encryption key](#secret-encryption-key)                                           |
| `workers.enabled`                               | `true`                       | Run the background workers on this instance. Set `false` on API-only instances                                         |
| `workers.pollIntervalMs`                        | `10000`                      | Interval between worker ticks                                                                                          |
| `workers.inbound`                               | `true`                       | Scan `RecvTarget` on each tick. `false` skips the scan                                                                 |
| `workers.inboundArchivePath`                    | `<dataPath>/sidecar/inbound` | Where processed `RecvTarget` files are moved, as `<date>/<message>/` (unrecognized files go to `<date>/unrecognized/`) |
| `workers.stalledAfterMinutes`                   | `120`                        | Emit `submission.stalled` once for a `WRITTEN` submission with no result after this long. The status does not change   |
| `validation.issueDeadlineHours`                 | `48`                         | B2C upload deadline, counted from `issuedAt`                                                                           |
| `validation.b2bIssueDeadlineHours`              | `168`                        | B2B upload deadline, counted from `issuedAt`                                                                           |
| `validation.xmlValidator`                       | none                         | Called with `(xml, messageType)` for each generated XML. Throw to reject the document before it is queued              |
| `notifications.invoiceTrackRunningLowThreshold` | `50`                         | Emit `invoice-track.running-low` when a period's remaining numbers fall below this value, and again at zero            |
| `notifications.certificateExpiryNoticeDays`     | `30`                         | Start `certificate.expiring` notices this many days before the software certificate expires                            |
| `print.fontPath`                                | none                         | CJK font file (TTF, OTF or TTC). Required for `PDF`, `PNG` and `A4_PDF`                                                |
| `print.paperWidthMm`                            | `57`                         | Thermal paper width for the PDF layout. ESC/POS uses 384 dots for 57 and 58 mm, and 576 dots for 80 mm                 |

## Secret encryption key

`secretEncryptionKey` encrypts stored secrets, currently the company QR AES keys. Values are sealed with AES-256-GCM, and the cipher key is the SHA-256 hash of this string.

- **Losing or changing the value makes the stored QR keys unreadable.** `describe()` and the REST and GraphQL company reads fail, and proof printing that needs QR codes fails, until each QR key is set again with `setQrAesKey`.
- **Rotation is not supported.** There is no re-encryption step. Changing the value means entering every QR key again.
- Keep the value in your secret manager, use the same value on every instance, and set it before the first QR key is saved.

## Company registration

Each seller must be registered before it can issue. Registration is an upsert keyed by the tax ID.

| Entry point | Register                                      | Set QR AES key                                                 | Read                                          |
| ----------- | --------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| REST        | `PUT /{routePrefix}/companies/{companyTaxId}` | `PUT /{routePrefix}/companies/{companyTaxId}/qr-aes-key` (204) | `GET /{routePrefix}/companies/{companyTaxId}` |
| GraphQL     | `registerTurnkeyCompany(companyTaxId, input)` | `setTurnkeyQrAesKey(companyTaxId, aesKey)`                     | `turnkeyCompany(companyTaxId)`                |
| Service     | `TurnkeyCompanyService.register({...})`       | `TurnkeyCompanyService.setQrAesKey(taxId, hexKey)`             | `TurnkeyCompanyService.describe(taxId)`       |

```typescript
await companyService.register({
  taxId: '12345675',
  name: '測試營業人',
  routingId: 'ROUTE-TEST',
  exchangeEnabled: false,
  certificateExpiresAt: new Date('2030-01-31T00:00:00+08:00'),
});

await companyService.setQrAesKey('12345675', 'AABBCCDDEEFF00112233445566778899');
```

| Field                    | Required            | Meaning                                                                                              |
| ------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------- |
| `taxId` / `companyTaxId` | yes                 | 8-digit unified business number. The checksum must pass (`INVALID_TAX_ID`)                           |
| `name`                   | yes                 | Company name. Must not be blank                                                                      |
| `address`                | no                  | Company address. Required for `EXCHANGE` invoices and allowances (`SELLER_ADDRESS_REQUIRED`)         |
| `routingId`              | yes                 | Routing code (繞送代碼) of the seller in Turnkey, 1 to 39 characters                                 |
| `exchangeEnabled`        | no, default `false` | Must be `true` before the seller can issue `EXCHANGE` invoices. Otherwise `BUYER_NOT_EXCHANGE_READY` |
| `certificateExpiresAt`   | no                  | Expiry date of the software certificate. Drives the `certificate.expiring` notices                   |

**QR AES key.** The left and right QR codes on a printed invoice proof carry an encrypted verification code (invoice number and random number), encrypted with AES-128-CBC. The key is 32 hexadecimal characters (16 bytes), the key configured for the company's QR codes. It is stored encrypted with `secretEncryptionKey` and is never returned; reads report only whether a key is set. Without a key, proofs that need QR codes cannot be printed (`QR_KEY_MISSING`).

## Invoice tracks and periods

Register the number ranges before issuing: REST `POST /{routePrefix}/companies/{companyTaxId}/invoice-tracks`, GraphQL `registerTurnkeyInvoiceTrack`, or `TurnkeyInvoiceTrackService.register()`.

| Field         | Format                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `period`      | `YYYMM`: ROC year (3 digits) and an even month that ends the two-month period. For example `11510` covers September and October 2026 |
| `track`       | Exactly two uppercase letters, for example `ZZ`                                                                                      |
| `beginNumber` | Exactly 8 digits                                                                                                                     |
| `endNumber`   | Exactly 8 digits, with `endNumber >= beginNumber` and `endNumber - beginNumber < 10000`                                              |

- The period of an invoice comes from `issuedAt` in Asia/Taipei time. Odd months round up to the period's even month, so September 2026 gives `11510`.
- A range that duplicates or overlaps an existing range of the same period and track is rejected (`INVALID_TRACK`).
- The module does not check alignment to 50-number booklets. Align the ranges yourself.
- A blank-number report (E0402) is accepted only after the period has ended. Before that it fails with `INVALID_TRACK`.

## Turnkey database access

Create a dedicated read-only role for the app. The compose example names it `turnkey_sidecar`; use the same name here and in [Docker guide, section 4.3](../../docker/invoice-turnkey/README.md#43-give-the-app-a-read-only-role). Grant column-level `SELECT` on the columns the module reads:

```sql
GRANT SELECT (task, filename, status, uuid, seqno, subseqno, process_dts)
  ON turnkey_message_log_detail TO turnkey_sidecar;
GRANT SELECT (uuid, status, seqno, subseqno)
  ON turnkey_message_log TO turnkey_sidecar;
GRANT SELECT (uuid, errorcode, eventdts, message1, message2, message3, message4, message5, message6)
  ON turnkey_sysevent_log TO turnkey_sidecar;
```

These grants do not cover lookups by invoice identifier. The [Docker guide, section 10.4](../../docker/invoice-turnkey/README.md#104-submissions-stuck-in-written) suggests such a lookup through this role. Use a separately approved role for it, or look up by UUID or file name.

## Background workers

Four Turnkey schedules must exist ([Docker guide, section 5.3](../../docker/invoice-turnkey/README.md#53-schedules-four-tasks-are-required)). Each runs as `PERIOD` with interval `00:01`:

| Schedule (Turnkey menu)    | What it does                             | Without it                                                               |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `A:發票上傳` (Upload)      | Uploads files from `UpCast`              | Submissions are never sent and stay `WRITTEN`                            |
| `A:發票下載` (ReceiveFile) | Downloads platform replies               | Replies are never downloaded                                             |
| `D:下載拆封` (Unpack)      | Writes results into Turnkey's log tables | **Submissions stay `WRITTEN` forever**, because no result is ever logged |
| `D:下載轉檔` (DownCast)    | Converts replies into `RecvTarget`       | No `RecvTarget` files are produced, so inbound replies are never applied |

The module cannot detect a missing schedule. Check them in Turnkey after every upgrade or restore.

Workers (the writer, the poller, the inbound scan and the maintenance) run on one tick every `workers.pollIntervalMs`. Each tick runs in this order: write pending submissions, poll `WRITTEN` results, scan `RecvTarget` (unless `workers.inbound` is `false`), then maintenance. Maintenance runs at most once an hour: it purges expired idempotency keys, emits certificate notices, and reconciles yesterday's `SummaryResult` files after 01:30 Asia/Taipei time.

Workers run only on the instance that holds the PostgreSQL session advisory lock, so one instance per database does the work. Set `workers.enabled: false` on API-only instances.

## Submissions stuck in WRITTEN

A submission is `WRITTEN` once its XML is in `UpCast` and until Turnkey logs a result. When no result arrives within `workers.stalledAfterMinutes`, the module emits `submission.stalled` once for that submission. The status does not change.

1. **Do not resend.** The platform may still accept the file, and a resend can issue the same invoice twice.
2. **Check Turnkey first.** Follow [Docker guide, section 10.4](../../docker/invoice-turnkey/README.md#104-submissions-stuck-in-written): check the `UpCast`, `Pack` and `SendFile` folders and their `ERR/` directories, the logs, and the `ProcessResult` files.
3. **Resolve through the API** once you know the outcome:
   - REST: `POST /{routePrefix}/companies/{companyTaxId}/submissions/{submissionId}/resolve` with `{ "status": "ACCEPTED", "reason": "..." }` or `"FAILED"`.
   - GraphQL: `resolveTurnkeySubmission(companyTaxId, submissionId, status, reason, idempotencyKey)`.
   - Only `ACCEPTED` and `FAILED` are valid. Any other status is refused (`INVALID_STATE`). The result is recorded with result code `MANUAL`.
   - Only `WRITTEN` submissions can be resolved. A platform result that arrives later is not applied, because the row is no longer `WRITTEN`.
4. **Retry if it failed.** A `FAILED` or `REJECTED` submission can be retried with `POST .../submissions/{submissionId}/retry`, or with `retry()` in `@rytass/invoice-adapter-turnkey`. Other statuses are refused (`INVALID_STATE`).
5. **Never edit the module's tables by hand.**

Void and annul require an invoice in `ISSUED` or `CONFIRMED`, so both are refused while the invoice is still `SUBMITTED`. Blank-number reports are not blocked by a `WRITTEN` submission, so wait for the submission to resolve before reporting its number blank.

## Inbound replies

Replies from the platform arrive in `RecvTarget/<message>/*.xml`. The inbound scan reads them on each tick unless `workers.inbound` is `false`. Processed files move to `workers.inboundArchivePath/<date>/<message>/`, and unrecognized files move to `<date>/unrecognized/`. The scan needs the DownCast schedule ([Background workers](#background-workers)).

**Seller side.** Buyer replies move the invoice or allowance state: A0102 (confirm) and B0102 move `ISSUED` to `CONFIRMED`; A0301 (reject) moves `ISSUED` or `CONFIRMED` to `REJECTED`; A0202 (void confirm) and B0202 move `VOID_PENDING` to `VOIDED`. If the invoice is still `SUBMITTED` when a reply arrives, the file stays in `RecvTarget` and is applied on a later tick.

**Buyer side.** Arrivals (A0101, A0201, A0302, B0101, B0201) are stored as received documents and listed by the received-document endpoints. Nothing is applied automatically. An A0302 (the seller acknowledges our rejection) needs no reply: it is stored as `REJECTION_ACKNOWLEDGED`, and the rejected A0101 moves from `REJECTED` to `REJECTION_ACKNOWLEDGED`. You reply to the others with one of these operations:

| Reply                  | REST                                                                 | GraphQL                               | Sends | Document status after an accepted reply |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------- | ----- | --------------------------------------- |
| Confirm invoice        | `POST /received-invoices/:documentNumber/confirm`                    | `confirmTurnkeyReceivedInvoice`       | A0102 | `CONFIRMED`                             |
| Reject invoice         | `POST /received-invoices/:documentNumber/reject` (`reason` required) | `rejectTurnkeyReceivedInvoice`        | A0301 | `REJECTED`                              |
| Confirm invoice void   | `POST /received-invoices/:documentNumber/void/confirm`               | `confirmTurnkeyReceivedInvoiceVoid`   | A0202 | `CONFIRMED`                             |
| Confirm allowance      | `POST /received-allowances/:documentNumber/confirm`                  | `confirmTurnkeyReceivedAllowance`     | B0102 | `CONFIRMED`                             |
| Confirm allowance void | `POST /received-allowances/:documentNumber/void/confirm`             | `confirmTurnkeyReceivedAllowanceVoid` | B0202 | `CONFIRMED`                             |

Reply body: `sellerTaxId` (required, because the same document number can come from different sellers), `documentDate` (`yyyyMMdd`; required when the same seller sent more than one document with that number, otherwise `INVALID_STATE` on `documentDate`), `reason` (required for reject) and `remark`.

A reply is sent as an outbound submission. If the platform rejects the reply, the document returns to `RECEIVED`, and you can reply again.

## Events

Each state change is written to the `turnkey_events` outbox in the same transaction as the change. An event has `id` (the outbox sequence; use it for de-duplication), `type`, `companyTaxId`, `data` and `createdAt`.

`companyTaxId` is the seller for invoice, allowance and submission events, and the buyer for received-document events.

| Event                                     | Fires when                                                                                         | `data` keys                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `submission.accepted`                     | The platform accepted a submission, or it was resolved as `ACCEPTED`                               | `submissionId`, `messageType`, `documentNumber`, `code`, `message`                |
| `submission.rejected`                     | The platform rejected a submission                                                                 | same as `submission.accepted`                                                     |
| `submission.failed`                       | A submission failed, or it was resolved as `FAILED`                                                | same as `submission.accepted`                                                     |
| `submission.stalled`                      | A submission stayed `WRITTEN` past `stalledAfterMinutes`. Once per submission; status unchanged    | `submissionId`, `messageType`, `documentNumber`, `fileName`, `writtenAt`          |
| `invoice.issued`                          | F0401 or A0101 was accepted                                                                        | `invoiceNumber`, `messageType`                                                    |
| `invoice.confirmed`                       | The buyer confirmed the invoice (A0102)                                                            | `invoiceNumber`, `messageType`, `occurredAt`, `reason`                            |
| `invoice.rejected`                        | The buyer rejected the invoice (A0301)                                                             | `invoiceNumber`, `messageType`, `occurredAt`, `reason`                            |
| `invoice.voided`                          | A void was accepted (F0501), or the buyer confirmed it (A0202)                                     | `invoiceNumber`; buyer replies also carry `messageType`, `occurredAt`, `reason`   |
| `invoice.annulled`                        | An annulment was accepted (F0701)                                                                  | `invoiceNumber`                                                                   |
| `allowance.issued`                        | An allowance was accepted (G0401 or B0101)                                                         | `allowanceNumber`, `messageType`                                                  |
| `allowance.confirmed`                     | The buyer confirmed the allowance (B0102)                                                          | `allowanceNumber`, `messageType`, `occurredAt`, `reason`                          |
| `allowance.voided`                        | An allowance void was accepted (G0501), or the buyer confirmed it (B0202)                          | `allowanceNumber`; buyer replies also carry `messageType`, `occurredAt`, `reason` |
| `received-invoice.arrived`                | An A0101 arrived                                                                                   | `documentNumber`, `messageType`, `sellerTaxId`, `occurredAt`, `reason`            |
| `received-invoice.void-requested`         | An A0201 (the seller requests a void) arrived                                                      | same as `received-invoice.arrived`                                                |
| `received-invoice.rejection-acknowledged` | An A0302 (the seller acknowledges our rejection) arrived                                           | same as `received-invoice.arrived`                                                |
| `received-allowance.arrived`              | A B0101 arrived                                                                                    | same as `received-invoice.arrived`                                                |
| `received-allowance.void-requested`       | A B0201 arrived                                                                                    | same as `received-invoice.arrived`                                                |
| `reconciliation.completed`                | The daily `SummaryResult` reconciliation for a date finished, once for each company in the summary | `date`, `summaryMessages`, `matched`, `issues`                                    |
| `invoice-track.running-low`               | A period's remaining numbers fell below the threshold, and again at zero                           | `period`, `remaining`                                                             |
| `certificate.expiring`                    | The software certificate is within the notice window. At most once per company per day             | `expiresAt`, `daysLeft`                                                           |

**Polling (REST).** Read the outbox with a cursor:

```
GET /{routePrefix}/companies/{companyTaxId}/events?after={cursor}&limit=100
→ { "events": [ ... ], "nextCursor": "..." }
```

Store `nextCursor` and pass it as `after` the next time. Omit `after` to read from the beginning. When there are no new events, `nextCursor` equals `after`. `limit` defaults to 100 and must be 1 to 500 (REST returns 400 otherwise). GraphQL: `turnkeyEvents(companyTaxId, after, limit)`, which clamps `limit` silently.

The in-process `EventEmitter` is only a wake-up signal. Use the cursor for reliable delivery, so a consumer that was down can catch up.

**Notify packages.** The outbox can be published to a broker:

- `@rytass/invoice-turnkey-base-nestjs-nats-notify-module` publishes to NATS JetStream (`TurnkeyNatsNotifyModule.forRoot({ servers, subjectPrefix })`).
- `@rytass/invoice-turnkey-base-nestjs-redis-notify-module` publishes to Redis (Streams or Pub/Sub).

Register `TurnkeyBaseModule` (directly or through the REST module) before either notify module.

## Validation

The module checks invoice input before any XML is written. A failed check throws `TurnkeyValidationError` with `code`, `message`, `field` and `issues`, and no number is used.

### What the module validates, and what you must validate

| Area        | Checked by the module                                                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amounts     | Line totals (`ITEM_SUM_MISMATCH`), tax (`TAX_AMOUNT_MISMATCH`), total (`TOTAL_AMOUNT_MISMATCH`)                                                                                              |
| Tax IDs     | Format and checksum of buyer and seller tax IDs (`INVALID_TAX_ID`); exchange needs a buyer tax ID (`BUYER_TAX_ID_REQUIRED`)                                                                  |
| Carrier     | Mobile barcode and MOICA format; MEMBER and PLATFORM need a 6-character type code (`INVALID_CARRIER`)                                                                                        |
| Donation    | 3 to 7 digits (`UNKNOWN_NPO_CODE`); not allowed on B2B or printed invoices (`DONATION_NOT_ALLOWED`)                                                                                          |
| Print mark  | Required without a carrier or donation; not allowed with a carrier, except a mobile barcode on a B2B invoice (`PRINT_MARK_REQUIRED`)                                                         |
| Tax types   | No `MIXED` on exchange or with a special rate; `SPECIAL` needs `specialTaxRate` from 0 to 1 (`TAX_TYPE_NOT_ALLOWED`)                                                                         |
| Zero-rated  | Clearance mark and reason code 71 to 79 (`ZERO_RATED_FIELDS_REQUIRED`)                                                                                                                       |
| Dates       | Not more than 3 days in the future (`ISSUED_IN_FUTURE`); within the upload deadline (`ISSUE_DEADLINE_PASSED`); not earlier than the previous invoice in the same track (`DATE_OUT_OF_ORDER`) |
| Numbers     | Track format and ranges (`INVALID_TRACK`); unused numbers left in the period (`NO_AVAILABLE_NUMBER`)                                                                                         |
| Allowances  | Item amounts and matching original items (`ALLOWANCE_AMOUNT_INVALID`); total within the invoice (`ALLOWANCE_EXCEEDS_INVOICE`)                                                                |
| Exchange    | Seller `exchangeEnabled` (`BUYER_NOT_EXCHANGE_READY`); seller address, which A0101 and B0101 require (`SELLER_ADDRESS_REQUIRED`)                                                             |
| Idempotency | Reused `externalId` with different content (`EXTERNAL_ID_CONFLICT`)                                                                                                                          |

The module does not check the following in real time. [Docker guide, section 10.3](../../docker/invoice-turnkey/README.md#103-checks-the-issuing-system-must-do) lists the rules you must check in your issuing system:

- Whether a donation code is on the charity list, and whether a mobile barcode or carrier code exists. The module checks format only.
- Whether a buyer tax ID belongs to a registered company. The module checks the checksum only.
- Which business case applies. Annulment is only for system errors that require reissuing under the same number. Wrong entries are voided and reissued under a new number. Returns and price reductions use allowances.
- Price semantics: B2C unit prices include tax, B2B unit prices exclude it.

### Validation codes

| Code                            | Meaning                                                                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ITEM_SUM_MISMATCH`             | Line amounts do not add up to the sales amount, or there are no items                                                                                                                                                               |
| `TAX_AMOUNT_MISMATCH`           | Tax is not the sales amount times the rate, rounded                                                                                                                                                                                 |
| `TOTAL_AMOUNT_MISMATCH`         | Total is not sales plus tax                                                                                                                                                                                                         |
| `INVALID_TAX_ID`                | A tax ID is malformed or fails the checksum, or a required seller tax ID is missing                                                                                                                                                 |
| `INVALID_CARRIER`               | Carrier code does not match its type, or the type code of a MEMBER or PLATFORM carrier is missing                                                                                                                                   |
| `UNKNOWN_NPO_CODE`              | Donation code is not 3 to 7 digits. This is a format check; the name is misleading                                                                                                                                                  |
| `ALLOWANCE_EXCEEDS_INVOICE`     | Allowances would exceed the invoice amount                                                                                                                                                                                          |
| `ALLOWANCE_AMOUNT_INVALID`      | Allowance has no items, a zero or negative amount, no matching original item, or an allowance number longer than 16 characters                                                                                                      |
| `ALLOWANCE_BUYER_MISMATCH`      | Defined, but not raised in this version                                                                                                                                                                                             |
| `INVOICE_NOT_FOUND`             | No invoice with that number for the company                                                                                                                                                                                         |
| `NUMBER_OUT_OF_TRACK`           | Defined, but not raised in this version                                                                                                                                                                                             |
| `NUMBER_ALREADY_REPORTED_BLANK` | The number was reported blank and cannot be used                                                                                                                                                                                    |
| `DATE_OUT_OF_ORDER`             | Invoice date is earlier than the previous invoice in the same track                                                                                                                                                                 |
| `ISSUE_DEADLINE_PASSED`         | `issuedAt` is older than the upload deadline (48 hours for B2C and 168 hours for B2B by default)                                                                                                                                    |
| `ISSUED_IN_FUTURE`              | `issuedAt` is more than 3 days in the future                                                                                                                                                                                        |
| `ZERO_RATED_FIELDS_REQUIRED`    | Zero-rated sales without a clearance mark or a reason code of 71 to 79                                                                                                                                                              |
| `PRINT_MARK_REQUIRED`           | Print mark is missing without a carrier or donation, or a printed invoice has a carrier                                                                                                                                             |
| `BUYER_TAX_ID_REQUIRED`         | Exchange invoice without a buyer tax ID                                                                                                                                                                                             |
| `TAX_TYPE_NOT_ALLOWED`          | `MIXED` on exchange or with a special rate, or `SPECIAL` without a valid `specialTaxRate`                                                                                                                                           |
| `DONATION_NOT_ALLOWED`          | Donation on a B2B invoice or on a printed invoice                                                                                                                                                                                   |
| `BUYER_NOT_EXCHANGE_READY`      | `EXCHANGE` requested, but the seller's `exchangeEnabled` is `false`. The name suggests the buyer; the check is on the seller                                                                                                        |
| `SELLER_ADDRESS_REQUIRED`       | `EXCHANGE` invoice or allowance, but the company has no `address`. A0101 and B0101 require `Seller.Address`; without it Turnkey rejects the file locally (`7001`) after the number is used. The check runs before a number is taken |
| `NO_AVAILABLE_NUMBER`           | No unused number is left in the period's tracks                                                                                                                                                                                     |
| `INVALID_STATE`                 | Operation not allowed in the current state, for example voiding a non-issued invoice, or retrying a submission that is not `FAILED` or `REJECTED`, or resolving to a status other than `ACCEPTED` or `FAILED`                       |
| `COMPANY_NOT_REGISTERED`        | The company is not registered                                                                                                                                                                                                       |
| `INVALID_TRACK`                 | Malformed period, track or range; `endNumber` before `beginNumber`; a range too large; an overlapping range; or a blank report before the period ends                                                                               |
| `SUBMISSION_NOT_FOUND`          | No submission with that id, or the id is not a UUID                                                                                                                                                                                 |
| `EXTERNAL_ID_CONFLICT`          | `externalId` was already used for an invoice with different content                                                                                                                                                                 |

The exception filters map these codes to HTTP statuses ([REST errors](../invoice-turnkey-base-nestjs-rest-module/README.md#errors)).

## Proof printing

`TurnkeyInvoicePrintService.buildProof()` returns the data for an invoice proof: the barcode, both QR codes, and a reprint flag. Each print is logged in `turnkey_print_logs`. Prints after the first are marked 補印 on the proof. The QR codes need the company's QR AES key, set with `TurnkeyCompanyService.setQrAesKey(taxId, hexKey)` (REST `PUT .../qr-aes-key`, GraphQL `setTurnkeyQrAesKey`).

`render(proof, { format })` turns the data into a file. Install the renderer libraries only if you need files; they are optional peer dependencies:

```bash
yarn add qrcode bwip-js pdfkit fontkit pngjs iconv-lite
```

| Format    | Output                                                     |
| --------- | ---------------------------------------------------------- |
| `JSON`    | Proof data only; no renderer needed                        |
| `PDF`     | Thermal layout for the paper width in `print.paperWidthMm` |
| `PNG`     | The same layout as a bitmap                                |
| `ESC_POS` | Printer bytes: Big5 text and raster codes                  |
| `A4_PDF`  | A4 proof with an item table, paged with repeated headers   |

Every format except `JSON` needs a CJK font: set `print.fontPath`. Without the font or the libraries, `render()` throws `TurnkeyPrintError` with code `RENDERER_UNAVAILABLE`.

## Entity tables

The module registers 13 entities with `TypeOrmModule.forFeature`. No migrations are shipped.

| Table                        | Holds                                                  |
| ---------------------------- | ------------------------------------------------------ |
| `turnkey_companies`          | Registered sellers, with the encrypted QR AES key      |
| `turnkey_invoice_tracks`     | Registered number ranges per company, period and track |
| `turnkey_invoice_numbers`    | Each invoice number and its status                     |
| `turnkey_invoices`           | Invoice header and status                              |
| `turnkey_invoice_items`      | Invoice line items                                     |
| `turnkey_allowances`         | Allowance header and status                            |
| `turnkey_allowance_items`    | Allowance line items                                   |
| `turnkey_submissions`        | Submissions: status, XML file name and platform result |
| `turnkey_received_documents` | Documents received as buyer, and their reply status    |
| `turnkey_events`             | Event outbox                                           |
| `turnkey_event_cursors`      | Event cursors                                          |
| `turnkey_idempotency_keys`   | Idempotency keys and stored responses (kept 7 days)    |
| `turnkey_print_logs`         | Proof print log, used for the 補印 marking             |

Generate and run migrations in the host app. `synchronize` is a choice for the host, and it is for development only.

## Deployment notes

- **Shared volume.** Turnkey and the app must see the same `/data`. The writer writes temporary files under `sidecar/tmp` and then renames them into place, so both paths must be on the same file system ([Docker guide, section 6.2](../../docker/invoice-turnkey/README.md#62-same-file-system-for-the-writer)).
- **Permissions.** The app must be able to create and rename files in `sidecar/tmp`, `sidecar/inbound`, the `UpCast/.../SRC` directories and the `RecvTarget` archive. The module creates missing directories, but the app user still needs write access to the tree. The compose example runs the app as UID 1000 and GID 1000, but that does not make `/data` writable by itself. Check with a write test as the app user ([Docker guide, section 6.3](../../docker/invoice-turnkey/README.md#63-permissions-and-uid)).
- **Kubernetes.** Run Turnkey and the app in the same Pod with a shared volume, or use a ReadWriteMany volume. Run exactly one Turnkey container per `/data` volume. Set `fsGroup` for write access ([Docker guide, section 7.4](../../docker/invoice-turnkey/README.md#74-kubernetes)).
- **Workers on one instance.** See [Background workers](#background-workers) and [section 7.3](../../docker/invoice-turnkey/README.md#73-workers-run-on-one-instance) of the Docker guide.
- **Cut-over.** Follow the [production cut-over checklist](../../docker/invoice-turnkey/README.md#13-production-cut-over) before you switch to production.
