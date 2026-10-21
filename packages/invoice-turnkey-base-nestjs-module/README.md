# Rytass Utils - Invoice Turnkey Base NestJS Module

NestJS base module for issuing Taiwan e-invoices directly through the MOF e-Invoice **Turnkey** (no value-added center). The app runs next to a Turnkey container, shares its `/data` volume, writes MIG 4.1 XML into `UpCast`, and reads results from Turnkey's own database.

> Status: early development (0.x). Storage invoices, voids, annulments and allowances are verified against the MOF test platform; exchange (B2B) flows are implemented but not yet verified with a real counterparty.

## Features

- [x] Validation without a database: amounts, tax ID checksum, carrier and donation formats, print mark, zero-rated fields, upload deadline
- [x] MIG 4.1 XML for F0401, F0501, F0701, G0401, G0501, A0101–A0302, B0101–B0202 and E0402
- [x] Invoice track registration and serialized number allocation
- [x] SubmissionWriter: atomic write into `UpCast/<category>/<message>/SRC/`
- [x] StatusPoller: reads `turnkey_message_log_detail`, `turnkey_message_log` and `turnkey_sysevent_log` (manual chapter 捌 上傳狀態查詢)
- [x] Event outbox (`turnkey_events`) with an in-process `EventEmitter` wake-up signal
- [x] Proof codes: 1D barcode and left/right QR codes (AES-128-CBC verification code)
- [x] Void (F0501 / A0201), annul (F0701, storage invoices only), allowance and allowance void (G0401 / B0101, G0501 / B0201)
- [x] Exchange: buyer confirm / reject / void-confirm replies, rejection acknowledgement (A0302)
- [x] Inbound watcher: parses `RecvTarget/<message>/*.xml`, applies replies, archives files to `sidecar/inbound/<date>/<message>/`
- [x] Submission retry with the same XML (`TurnkeySubmissionService.retry`), abandoning returned numbers, blank-number report (E0402)
- [x] Maintenance: idempotency-key purge, `certificate.expiring` events (once per company per day)
- [x] Daily reconciliation: compares `Unpack/BAK/SummaryResult/<date>/` with our submissions after 01:30 Taipei time, emits `reconciliation.completed`
- [x] Proof printing: proof data, print log with reprint marking, renderers for 57 mm PDF / PNG / ESC/POS and A4 PDF (invoice and allowance)
- [ ] Reissuing an annulled invoice under its original number

## Installation

```bash
yarn add @rytass/invoice-turnkey-base-nestjs-module @nestjs/typeorm typeorm pg
```

## Basic Usage

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TurnkeyBaseModule } from '@rytass/invoice-turnkey-base-nestjs-module';

@Module({
  imports: [
    // the app's own database (turnkey_* tables live here)
    TypeOrmModule.forRoot({ type: 'postgres', url: process.env.DATABASE_URL, autoLoadEntities: true }),
    // Turnkey's database, read-only account
    TypeOrmModule.forRoot({ name: 'turnkey', type: 'postgres', url: process.env.TURNKEY_DATABASE_URL }),
    TurnkeyBaseModule.forRoot({
      dataPath: '/data',
      turnkeyDataSource: 'turnkey',
      environment: 'TEST',
      secretEncryptionKey: process.env.TURNKEY_SECRET_KEY as string,
    }),
  ],
})
export class AppModule {}
```

```typescript
const invoice = await turnkeyInvoiceService.issue({
  companyTaxId: '12345675',
  deliveryMode: TurnkeyDeliveryMode.STORAGE,
  buyer: { taxId: '87654322', name: 'Buyer Co., Ltd.' },
  items: [{ description: 'Monthly pass', quantity: 1, unitPrice: 1280, taxType: TurnkeyTaxType.TAXABLE }],
});
// invoice.status === SUBMITTED; the worker writes the XML and later moves it to ISSUED or FAILED
```

## Turnkey database access

Grant the app a dedicated read-only role with column-level `SELECT` on:

```sql
GRANT SELECT (task, filename, status, uuid, seqno, subseqno, process_dts) ON turnkey_message_log_detail TO turnkey_sidecar;
GRANT SELECT (uuid, status, seqno, subseqno, message_type, invoice_identifier) ON turnkey_message_log TO turnkey_sidecar;
GRANT SELECT (uuid, errorcode, eventdts, message1, message2, message3, message4, message5, message6) ON turnkey_sysevent_log TO turnkey_sidecar;
```

The module never uses `SELECT *`, so column-level grants are enough. Never grant the password columns of the configuration tables.

## Background workers

Workers (writer, poller, inbound watcher and hourly maintenance) run only on the instance that holds a PostgreSQL session advisory lock; set `workers.enabled: false` on API-only instances. Turnkey periodically purges its log tables, so keep the poll interval short (default 10 s).

| Option                                          | Default                      | Meaning                                                                                  |
| ----------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| `workers.enabled`                               | `true`                       | Run background workers on this instance                                                  |
| `workers.pollIntervalMs`                        | `10000`                      | Interval of one write / poll / inbound round                                             |
| `workers.inbound`                               | `true`                       | Scan `RecvTarget`; `false` leaves received files untouched                               |
| `workers.inboundArchivePath`                    | `<dataPath>/sidecar/inbound` | Where processed `RecvTarget` files are moved                                             |
| `workers.stalledAfterMinutes`                   | `120`                        | Emit `submission.stalled` once for a `WRITTEN` submission with no result after this long |
| `notifications.invoiceTrackRunningLowThreshold` | `50`                         | Emit `invoice-track.running-low` below this many numbers                                 |
| `notifications.certificateExpiryNoticeDays`     | `30`                         | Emit `certificate.expiring` this many days before expiry                                 |

A stalled submission keeps its `WRITTEN` status: the platform may still accept it later, so marking it failed and resending could issue the same invoice twice. Until it resolves, voiding, annulling and blank-number reports for that document are refused; check the file in Turnkey (`UpCast`, `Pack`, `SendFile` and their `ERR/` folders) by hand.

The writer never creates `UpCast/.../SRC` directories: Turnkey creates them, so a missing directory means `dataPath` does not point at Turnkey's data volume, and the submission stays `PENDING` with an error in the log.

## Proof printing

`TurnkeyInvoicePrintService.buildProof()` returns the data for an invoice proof (barcode, both QR codes, reprint flag) and logs the print; the second and later prints of the same invoice are marked 補印. Pass `idempotencyKey` so a retried request returns the same print instead of a reprint. The QR codes need the company's QR AES key, set once with `TurnkeyCompanyService.setQrAesKey(taxId, hexKey)`; it is stored encrypted with `secretEncryptionKey`.

`render(proof, { format })` turns the data into a file. The renderers load their libraries on demand, so install them only if you need files:

```bash
yarn add qrcode bwip-js pdfkit fontkit pngjs iconv-lite
```

| Format    | Output                                                |
| --------- | ----------------------------------------------------- |
| `JSON`    | Proof data only, no renderer needed                   |
| `PDF`     | 57 mm thermal layout (`print.paperWidthMm`)           |
| `PNG`     | Same layout as a 16 px/mm bitmap                      |
| `ESC_POS` | Printer bytes: Big5 text and `GS v 0` raster codes    |
| `A4_PDF`  | A4 proof with item table, paged with repeated headers |

Every format except `JSON` needs a CJK font: set `print.fontPath` to a TTF, OTF or TTC file (for example Noto Sans TC). Without it, or without the libraries, `render()` throws `TurnkeyPrintError` with code `RENDERER_UNAVAILABLE`. ESC/POS output assumes a 384-dot (58 mm) printer and has not been tested on a physical printer yet.

## Migrations

Entities are registered with `TypeOrmModule.forFeature`; no migrations are shipped. Generate them in the host app.
