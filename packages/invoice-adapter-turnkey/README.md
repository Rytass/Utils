# Rytass Utils - Turnkey Invoice Adapter

`@rytass/invoice-adapter-turnkey` implements the `InvoiceGateway` interface from `@rytass/invoice` on top of the Turnkey REST module (company-scoped endpoints). It is a plain class, not a NestJS module, so it can be instantiated in any service.

## Installation

```bash
npm install @rytass/invoice-adapter-turnkey
# or
yarn add @rytass/invoice-adapter-turnkey
```

## Gateway Setup

```typescript
import { TurnkeyInvoiceGateway } from '@rytass/invoice-adapter-turnkey';

const gateway = new TurnkeyInvoiceGateway({
  baseUrl: 'https://turnkey.example.com/api', // must include the REST module's routePrefix
  companyTaxId: '12345675',
  deliveryMode: 'STORAGE', // optional, default 'STORAGE'
  headers: { Authorization: `Bearer ${token}` }, // optional, sent with every request
  timeoutMs: 30_000, // optional, default 30 seconds
});
```

Every request is sent to `${baseUrl}/companies/${companyTaxId}/...`.

## Issuing an Invoice

`orderId` is required. It is sent as `externalId` and as the `Idempotency-Key` of the issue request. Calling `issue()` again with the same `orderId` and the same content returns the stored result, so it never creates a second invoice. The same `orderId` with different content fails with `EXTERNAL_ID_CONFLICT` (409).

A rejected or failed submission is not resent automatically. After you fix a cause outside the XML, call [`retry(invoice)`](#retry). A retry resends the same XML, so content errors need a new invoice instead.

```typescript
import { InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-turnkey';

// B2C (unit prices include tax)
const invoice = await gateway.issue({
  orderId: 'ORDER-TEST-0001',
  items: [{ name: '咖啡豆', quantity: 2, unitPrice: 350, unit: '包', taxType: TaxType.TAXED }],
  carrier: InvoiceCarriers.MOBILE('/ABC+123'),
});

// B2B (unit prices exclude tax; vatNumber is sent as buyer.taxId)
const b2bInvoice = await gateway.issue({
  orderId: 'ORDER-TEST-0002',
  items: [{ name: '顧問服務', quantity: 1, unitPrice: 10000, taxType: TaxType.TAXED }],
  vatNumber: '87654322',
  buyer: { name: '測試營業人', address: '測試地址一號' },
  carrier: InvoiceCarriers.PRINT,
});
```

### Mapping

| `@rytass/invoice`                                     | Turnkey                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `TaxType.TAXED` / `ZERO_TAX` / `TAX_FREE` / `SPECIAL` | `TAXABLE` / `ZERO_RATED` / `TAX_FREE` / `SPECIAL`                                            |
| `InvoiceCarrierType.PRINT`                            | `printed: true`                                                                              |
| `InvoiceCarrierType.LOVE_CODE`                        | `donation.npoCode`                                                                           |
| `MOBILE`, `MOICA`, `MEMBER`, `PLATFORM`               | `carrier: { type, code }` (`code` is required; `MEMBER` and `PLATFORM` also need `typeCode`) |
| `CustomsMark.YES` / `NO`                              | `zeroRated.customsClearance` = `VIA_CUSTOMS` / `NOT_VIA_CUSTOMS`                             |

### Options the base interface cannot express

- `zeroRatedReasonCode` (`'71'`..`'79'`): required when any item is `TaxType.ZERO_TAX`.
- `specialTaxRate`: required when any item is `TaxType.SPECIAL`.
- `carrier.typeCode`: required for `MEMBER` and `PLATFORM` (6 characters, `[0-9A-Z]`, the carrier category number issued by the platform). Pass it as `carrier: { ...InvoiceCarriers.MEMBER, code, typeCode }`.
- `buyer.name` / `buyer.address`, `issuedAt`, `remark` (sent as `mainRemark`).

## EXCHANGE (B2B Delivery)

Invoices are delivered either by storage (`STORAGE`, the default) or by exchange (`EXCHANGE`), where the buyer receives the invoice through the platform. The delivery mode is set once per gateway instance, so create a second gateway for exchange invoices:

```typescript
const exchangeGateway = new TurnkeyInvoiceGateway({
  baseUrl: 'https://turnkey.example.com/api',
  companyTaxId: '12345675',
  deliveryMode: 'EXCHANGE',
});
```

Before you issue an exchange invoice:

- **The seller must be enabled for exchange.** Set `exchangeEnabled: true` on the company, with the REST company route (`PUT /{routePrefix}/companies/{companyTaxId}`), GraphQL `registerTurnkeyCompany`, or `TurnkeyCompanyService.register()`. Otherwise the issue fails with `BUYER_NOT_EXCHANGE_READY` (422). The name suggests the buyer, but the check is on the seller's flag.
- **The buyer must be ready to receive.** Set this up on the platform side first ([Docker guide, section 8](../../docker/invoice-turnkey/README.md#8-b2b-exchange-prerequisites)).
- **The buyer tax ID is required.** Pass `vatNumber`. Without it the issue fails with `BUYER_TAX_ID_REQUIRED` (422).
- **`TaxType.MIXED` is not allowed** on exchange invoices (`TAX_TYPE_NOT_ALLOWED`).

When the buyer rejects an exchange invoice, `invoice.turnkeyStatus` becomes `REJECTED`. Acknowledge the rejection with the REST route `POST /{routePrefix}/companies/{companyTaxId}/invoices/{invoiceNumber}/rejection/acknowledge`. This adapter does not wrap that route.

## Invoice States

Turnkey statuses are mapped to `InvoiceState` as follows. The raw Turnkey status is always available as `invoice.turnkeyStatus`.

| Turnkey status                                                 | `InvoiceState`                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `SUBMITTED`, `ISSUED`, `CONFIRMED`, `REJECTED`                 | `ISSUED`, or `ALLOWANCED` while the invoice has a non-voided allowance |
| `VOID_PENDING`, `VOIDED`, `ANNULLED`, `REJECTION_ACKNOWLEDGED` | `VOID`                                                                 |
| `FAILED`                                                       | `INITED`                                                               |

- `FAILED` invoices are returned by `query()` as usual. Check `turnkeyStatus` to decide whether to resubmit or give up.
- `VOID_PENDING` maps to `VOID` as soon as the platform reports it.
- `ALLOWANCED` is derived from the allowances. It applies while at least one allowance is not `INVALID` (`ISSUED`, `SUBMITTED`, `CONFIRMED` or `VOID_PENDING`). It returns to `ISSUED` when every allowance is voided.

## Querying

```typescript
await gateway.query({ orderId: 'ORDER-TEST-0001' }); // GET /invoices?externalId=
await gateway.query({ invoiceNumber: 'ZZ12345678' }); // GET /invoices/{invoiceNumber}
```

A missing invoice (404) throws `TurnkeyInvoiceError`.

After loading the invoice, `query()` also calls `GET /invoices/{invoiceNumber}/allowances` and restores `invoice.allowances`, so `nowAmount` reflects earlier allowances. This call is skipped when no invoice number has been assigned yet. `VOIDED` allowances stay in the list (status `INVALID`) but do not reduce `nowAmount`. `FAILED` allowances never took effect and are omitted.

## Voiding

```typescript
await gateway.void(invoice, { reason: '訂單取消' });
```

The request uses `void:<invoiceNumber>` as its `Idempotency-Key`.

## Allowances

```typescript
await gateway.allowance(invoice, [{ name: '退貨', quantity: 1, unitPrice: 350, taxType: TaxType.TAXED }]);

const allowance = invoice.allowances[0];
await gateway.invalidAllowance(allowance); // default reason: 作廢折讓
await gateway.invalidAllowance(allowance, '客戶取消');

const raw = await gateway.queryAllowance('AL0000001'); // raw GET /allowances/{allowanceNumber}
```

- Allowance items use the invoice's tax type unless `taxType` is given in the options. A MIXED invoice requires that option.
- The `Idempotency-Key` is `allowance:<invoiceNumber>:<sha256 of request body>`. Retrying identical content replays the stored allowance, which is not attached twice and does not reduce `nowAmount` again. To deliberately issue two identical allowances, pass `{ idempotencyKey: '...' }` with a distinct key per allowance.
- Why a content hash and not a sequence number: the hash is computed from the request alone, so a retry from another process, or after a lost response, produces the same key without reading the invoice first. The trade-off is that two separate partial refunds with identical content share a key, and the second one is treated as a replay. Pass a distinct `idempotencyKey` for each such refund.
- Allowance amounts are tax-inclusive. REST returns `totalAmount` as the untaxed amount plus a separate `taxAmount`, so the adapter deducts `totalAmount + taxAmount`, which is the same basis as the invoice `totalAmount`.
- A `FAILED` allowance throws and is not attached to the invoice.
- `invoice.nowAmount` is reduced by each allowance and restored when it is invalidated.

## Retry

When a submission is rejected by the platform or fails, the invoice or allowance stays in that state until you resend it. The retry resends the same XML, so it only fixes causes outside the XML: register the software certificate (`E0301`), delete a stale recipient entry in Turnkey (`E0146`), or restore the connection, then retry. If the content is wrong (for example a local `[7001]` schema error), a retry fails again: issue a new invoice, and abandon the failed number through the REST or GraphQL module so the period-end blank report includes it.

```typescript
const retried = await gateway.retry(invoice); // resend the latest REJECTED or FAILED submission
const retriedAllowance = await gateway.retryAllowance(allowance);
```

- `retry()` loads the latest submission of the invoice (`GET submissions?documentNumber=...&limit=1`). If it is `REJECTED` or `FAILED`, it sends `POST submissions/{id}/retry` with the key `retry:<submissionId>`, then queries the invoice again and returns it.
- Otherwise it throws `TurnkeyInvoiceError` with code `NOTHING_TO_RETRY` (409). This applies to any latest status other than `REJECTED` or `FAILED` (for example `WRITTEN` or `ACCEPTED`), and to an invoice that was never submitted.
- `retryAllowance()` does the same for the allowance, and returns the parent invoice.

## Proof (證明聯)

```typescript
const proof = await gateway.getProof('ZZ12345678'); // POST /invoices/{no}/proof
const pdf = await gateway.getProof('ZZ12345678', 'PDF'); // Buffer, application/pdf
const png = await gateway.getProof('ZZ12345678', 'PNG'); // Buffer, image/png
const escPos = await gateway.getProof('ZZ12345678', 'ESC_POS'); // Buffer, application/octet-stream
const a4 = await gateway.getProof('ZZ12345678', 'A4_PDF'); // Buffer, application/pdf

const allowanceProof = await gateway.getAllowanceProof('AL0000001'); // POST /allowances/{no}/proof

// retry-safe: the same key returns the same print instead of a reprint
const sameJob = await gateway.getProof('ZZ12345678', 'PDF', {
  idempotencyKey: `print-${jobId}`,
  operator: 'cashier-7',
});
```

- Formats are `JSON` (default), `PDF`, `PNG`, `ESC_POS` and `A4_PDF`. JSON returns the raw REST object (`TurnkeyInvoiceProofResponse` or `TurnkeyAllowanceProofResponse`). Date fields are ISO strings, the same as the other raw responses such as `queryAllowance`.
- Binary formats are fetched with `responseType: 'arraybuffer'` and returned as a `Buffer`.
- **Every call records a print in Turnkey, whatever the format, including JSON.** The first call is the original print. The second and later calls are reprints: `reprint` is `true` and the proof is marked 補印. Use the JSON format only when you need the data, because it still counts as a print.
- Each call sends an `Idempotency-Key`. Pass your own `idempotencyKey` (for example a print-job id) so a retry of the same job returns the same print; without it every call gets a fresh key and counts as a new print.
- Errors use the same `TurnkeyInvoiceError` mapping as the other methods, including for binary formats. `NOT_PRINTABLE` and `QR_KEY_MISSING` return 422, `NOT_FOUND` returns 404, `RENDERER_UNAVAILABLE` returns 501.

## Validation

```typescript
await gateway.isMobileBarcodeValid('/ABC+123'); // GET /validation/mobile-barcodes/{code}
await gateway.isLoveCodeValid('919'); // GET /validation/npo-codes/{code}
```

The Turnkey side checks format only. It does not query the Ministry of Finance registry.

## Errors

Non-2xx responses throw `TurnkeyInvoiceError`:

```typescript
import { TurnkeyInvoiceError } from '@rytass/invoice-adapter-turnkey';

try {
  await gateway.issue(options);
} catch (error) {
  if (error instanceof TurnkeyInvoiceError) {
    // error.status: 422 | 409 | 403 | 404 ...
    // error.code: e.g. 'IDEMPOTENCY_KEY_REUSED', or 'EXTERNAL_ID_CONFLICT' when the same
    //   orderId was already issued with different content
    // error.issues: [{ code, message, field }] for 422 validation errors
  }
}
```

Network and timeout errors are rethrown as plain `Error`. Input that the adapter checks before sending throws a plain `Error` and no request is made, the same as the other `@rytass/invoice-*` adapters: a missing `orderId`, empty `items`, a malformed `vatNumber`, `MIXED` on an item, a missing carrier `code` or `typeCode`, a missing `zeroRatedReasonCode` with `ZERO_TAX` items, a missing `specialTaxRate` with `SPECIAL` items, and an allowance on a mixed-tax invoice without a tax type. Check `instanceof TurnkeyInvoiceError` before reading `status` or `code`.
