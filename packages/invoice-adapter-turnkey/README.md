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

`orderId` is required. It is sent as `externalId` and used as the `Idempotency-Key` of the issue request, so retrying the same order is safe.

```typescript
import { InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-turnkey';

// B2C (unit prices include tax)
const invoice = await gateway.issue({
  orderId: 'ORDER-20261021-0001',
  items: [{ name: '咖啡豆', quantity: 2, unitPrice: 350, unit: '包', taxType: TaxType.TAXED }],
  carrier: InvoiceCarriers.MOBILE('/ABC+123'),
});

// B2B (unit prices exclude tax; vatNumber is sent as buyer.taxId)
const b2bInvoice = await gateway.issue({
  orderId: 'ORDER-20261021-0002',
  items: [{ name: '顧問服務', quantity: 1, unitPrice: 10000, taxType: TaxType.TAXED }],
  vatNumber: '04595257',
  buyer: { name: 'Acme Co., Ltd.', address: '台北市信義區' },
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

## Invoice States

Turnkey statuses are mapped to `InvoiceState` as follows. The raw Turnkey status is always available as `invoice.turnkeyStatus`.

| Turnkey status                                                 | `InvoiceState`                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `SUBMITTED`, `ISSUED`, `CONFIRMED`, `REJECTED`                 | `ISSUED`, or `ALLOWANCED` while the invoice has a non-voided allowance |
| `VOID_PENDING`, `VOIDED`, `ANNULLED`, `REJECTION_ACKNOWLEDGED` | `VOID`                                                                 |
| `FAILED`                                                       | `INITED`                                                               |

- `FAILED` invoices are returned by `query()` as usual. Check `turnkeyStatus` to decide whether to resubmit or give up.
- `VOID_PENDING` maps to `VOID` as soon as the platform reports it. `voidOn` comes from `voidedAt`, which is set for this status.
- `ALLOWANCED` is derived from the allowances. It applies while at least one allowance is not `INVALID` (`ISSUED`, `SUBMITTED`, `CONFIRMED` or `VOID_PENDING`). It returns to `ISSUED` when every allowance is voided.

## Querying

```typescript
await gateway.query({ orderId: 'ORDER-20261021-0001' }); // GET /invoices?externalId=
await gateway.query({ invoiceNumber: 'AB12345678' }); // GET /invoices/{invoiceNumber}
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

## Proof (證明聯)

```typescript
const proof = await gateway.getProof('AB12345678'); // POST /invoices/{no}/proof
const pdf = await gateway.getProof('AB12345678', 'PDF'); // Buffer, application/pdf
const png = await gateway.getProof('AB12345678', 'PNG'); // Buffer, image/png
const escPos = await gateway.getProof('AB12345678', 'ESC_POS'); // Buffer, application/octet-stream
const a4 = await gateway.getProof('AB12345678', 'A4_PDF'); // Buffer, application/pdf

const allowanceProof = await gateway.getAllowanceProof('AL0000001'); // POST /allowances/{no}/proof

// retry-safe: the same key returns the same print instead of a reprint
const sameJob = await gateway.getProof('AB12345678', 'PDF', {
  idempotencyKey: `print-${jobId}`,
  operator: 'cashier-7',
});
```

- Formats are `JSON` (default), `PDF`, `PNG`, `ESC_POS` and `A4_PDF`. JSON returns the raw REST object (`TurnkeyInvoiceProofResponse` or `TurnkeyAllowanceProofResponse`). Date fields are ISO strings, the same as the other raw responses such as `queryAllowance`.
- Binary formats are fetched with `responseType: 'arraybuffer'` and returned as a `Buffer`.
- **Every call records a print in Turnkey, whatever the format, including JSON.** The first call is the original print. The second and later calls are reprints: `reprint` is `true` and the proof is marked 補印. Use the JSON format only when you need the data, because it still counts as a print. `printCount` in the response shows how many times the proof has been printed.
- Each call sends an `Idempotency-Key`. Pass your own `idempotencyKey` (for example a print-job id) so a retry of the same job returns the same print; without it every call gets a fresh key and counts as a new print.
- Errors use the same `TurnkeyInvoiceError` mapping as the other methods, including for binary formats. `NOT_PRINTABLE` and `QR_KEY_MISSING` return 422, `NOT_FOUND` returns 404, `RENDERER_UNAVAILABLE` returns 501, and an unknown format returns 400.

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
    //   orderId was already issued with a different buyer, delivery mode or items
    // error.issues: [{ code, message, field }] for 422 validation errors
  }
}
```

Network and timeout errors are rethrown as plain `Error`.
