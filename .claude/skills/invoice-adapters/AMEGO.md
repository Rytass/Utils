# Amego Invoice Adapter Reference

Complete API reference for `@rytass/invoice-adapter-amego`.

## Installation

```bash
npm install @rytass/invoice-adapter-amego
```

## AmegoInvoiceGateway

The main gateway class for interacting with Amego's (光貿) e-invoice API.

### Constructor

```typescript
new AmegoInvoiceGateway(options?: AmegoInvoiceGatewayOptions)
```

**Parameters:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `appKey` | `string` | No | Amego API key (default: test credentials) |
| `vatNumber` | `string` | No | Seller's 8-digit VAT number (default: test) |
| `baseUrl` | `string` | No | API base URL (default: development) |

**Example:**

```typescript
import { AmegoInvoiceGateway, AmegoBaseUrls } from '@rytass/invoice-adapter-amego';

// Development (uses test credentials)
const devGateway = new AmegoInvoiceGateway();

// Production
const prodGateway = new AmegoInvoiceGateway({
  appKey: 'YOUR_APP_KEY',
  vatNumber: '12345678',
  baseUrl: AmegoBaseUrls.PRODUCTION,
});
```

---

### Methods

#### `issue(options: AmegoInvoiceIssueOptions): Promise<AmegoInvoice>`

Issues a new invoice. Amego requires explicit tax amount calculations.

**Parameters:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `orderId` | `string` | Yes | Unique order identifier (max 40 chars) |
| `items` | `AmegoPaymentItem[]` | Yes | Invoice line items |
| `taxType` | `TaxType` | Yes | Tax type for the invoice |
| `detailVat` | `boolean` | Yes | Whether item prices include tax (`true`: tax-included, `false`: pre-tax, requires vatNumber) |
| `salesAmount` | `number` | No | Taxable sales amount (auto-calculated if omitted) |
| `taxAmount` | `number` | No | Tax amount (auto-calculated if omitted) |
| `totalAmount` | `number` | No | Total amount (auto-calculated if omitted) |
| `freeTaxSalesAmount` | `number` | No | Tax-free sales amount (default: 0) |
| `zeroTaxSalesAmount` | `number` | No | Zero-rated sales amount (default: 0) |
| `taxRate` | `number` | No | Tax rate (default: 0.05 for 5%) |
| `remark` | `string` | No | Invoice remark |
| `vatNumber` | `string` | No | Buyer VAT number (for B2B invoices) |
| `buyerEmail` | `string` | No | Buyer email |
| `buyerName` | `string` | No | Buyer name |
| `carrier` | `InvoiceCarrier` | No | Carrier configuration (see InvoiceCarrierType) |

**Important Validation:**
- If `detailVat` is `false` (pre-tax prices), `vatNumber` is required
- If `carrier.type` is `PLATFORM`, `buyerEmail` is required

**Returns:** `Promise<AmegoInvoice>`

**Example:**

```typescript
import { TaxType, InvoiceCarrierType } from '@rytass/invoice-adapter-amego';

// Basic invoice (amounts auto-calculated)
const invoice = await gateway.issue({
  orderId: 'ORDER-2024-001',
  taxType: TaxType.TAXED,
  detailVat: true,  // prices include tax
  items: [
    {
      name: 'Product A',
      quantity: 2,
      unitPrice: 100,
      taxType: TaxType.TAXED,
    },
  ],
});

console.log('Invoice issued:', invoice.invoiceNumber);
console.log('Random code:', invoice.randomCode);

// Invoice with mobile carrier
const carrierInvoice = await gateway.issue({
  orderId: 'ORDER-2024-002',
  taxType: TaxType.TAXED,
  detailVat: true,
  items: [
    { name: 'Product B', quantity: 1, unitPrice: 500, taxType: TaxType.TAXED },
  ],
  carrier: {
    type: InvoiceCarrierType.MOBILE,
    code: '/ABC+123',
  },
  buyerEmail: 'customer@example.com',
});

// Invoice with love code donation
const donationInvoice = await gateway.issue({
  orderId: 'ORDER-2024-003',
  taxType: TaxType.TAXED,
  detailVat: true,
  items: [
    { name: 'Donation Item', quantity: 1, unitPrice: 100, taxType: TaxType.TAXED },
  ],
  carrier: {
    type: InvoiceCarrierType.LOVE_CODE,
    code: '168001',
  },
});

// B2B invoice with pre-tax prices
const b2bInvoice = await gateway.issue({
  orderId: 'ORDER-2024-004',
  taxType: TaxType.TAXED,
  detailVat: false,  // pre-tax prices, requires vatNumber
  vatNumber: '12345678',
  buyerName: 'Company Ltd.',
  items: [
    { name: 'Service', quantity: 1, unitPrice: 1000, taxType: TaxType.TAXED },
  ],
});
```

---

#### `allowance(invoice: AmegoInvoice, allowanceItems: AmegoPaymentItem[], options?: AmegoAllowanceOptions): Promise<AmegoInvoice>`

Creates an allowance (partial refund) for an invoice.

**Parameters:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `allowanceItems` | `AmegoPaymentItem[]` | Yes | Items to include in allowance |
| `options.allowanceType` | `AmegoAllowanceType` | No | Who issues allowance (default: SELLER_ISSUED) |

**Returns:** `Promise<AmegoInvoice>` - Invoice with added allowance

**Example:**

```typescript
import { AmegoAllowanceType } from '@rytass/invoice-adapter-amego';

const updatedInvoice = await gateway.allowance(
  invoice,
  [{ name: 'Product A', quantity: 1, unitPrice: 100, unit: 'pcs' }],
  { allowanceType: AmegoAllowanceType.SELLER_ISSUED }
);

console.log(updatedInvoice.allowances.length);
console.log(updatedInvoice.nowAmount);
```

---

#### `invalidAllowance(allowance: AmegoAllowance): Promise<AmegoInvoice>`

Invalidates an existing allowance.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `allowance` | `AmegoAllowance` | Yes | The allowance to invalidate |

**Returns:** `Promise<AmegoInvoice>` - Parent invoice with updated allowance

**Example:**

```typescript
const allowance = invoice.allowances[0];
const updatedInvoice = await gateway.invalidAllowance(allowance);

console.log(allowance.status); // InvoiceAllowanceState.INVALID
```

---

#### `query(options: AmegoInvoiceQueryArgs): Promise<AmegoInvoice>`

Queries an invoice by order ID or invoice number.

**Parameters (Option 1 - by orderId):**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `orderId` | `string` | Yes | Order ID used when issuing |

**Parameters (Option 2 - by invoice number):**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `invoiceNumber` | `string` | Yes | 10-digit invoice number |

**Returns:** `Promise<AmegoInvoice>`

**Example:**

```typescript
// Query by order ID
const invoice1 = await gateway.query({ orderId: 'ORDER-2024-001' });

// Query by invoice number
const invoice2 = await gateway.query({ invoiceNumber: 'AB12345678' });
```

---

#### `void(invoice: AmegoInvoice): Promise<AmegoInvoice>`

Voids an existing invoice.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `invoice` | `AmegoInvoice` | Yes | The invoice to void |

**Returns:** `Promise<AmegoInvoice>` - Invoice with updated state

**Example:**

```typescript
const voidedInvoice = await gateway.void(invoice);

console.log(voidedInvoice.state); // InvoiceState.VOID
console.log(voidedInvoice.voidOn); // Date when voided
```

---

#### `isMobileBarcodeValid(code: string): Promise<boolean>`

Validates a mobile barcode carrier code.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | `string` | Yes | Mobile barcode (e.g., '/ABC+123') |

**Returns:** `Promise<boolean>`

**Example:**

```typescript
const isValid = await gateway.isMobileBarcodeValid('/ABC+123');
if (!isValid) {
  throw new Error('Invalid mobile barcode');
}
```

---

#### `isLoveCodeValid(_code: string): Promise<boolean>`

**Note:** Amego does not expose a public love code validation API. This method throws an error when called.

---

## AmegoInvoice

Represents an issued invoice. Amego invoices have additional properties for tracking tax calculations.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `invoiceNumber` | `string` | 10-digit invoice number (mutable) |
| `randomCode` | `string` | 4-digit random code (mutable) |
| `issuedOn` | `Date` | Invoice issue date |
| `issuedAmount` | `number` | Original invoice amount |
| `orderId` | `string` | Related order ID |
| `taxType` | `TaxType` | Tax type of the invoice |
| `vatNumber` | `string` | Buyer VAT number (default: '0000000000') |
| `taxRate` | `number` | Tax rate (default: 0.05) |
| `taxAmount` | `number` | Calculated tax amount |
| `items` | `AmegoPaymentItem[]` | Invoice line items |
| `allowances` | `AmegoAllowance[]` | Current allowances |
| `accumulatedAllowances` | `AmegoAllowance[]` | All allowances including history |
| `state` | `InvoiceState` | Current invoice state |
| `voidOn` | `Date \| null` | Void date if voided |
| `nowAmount` | `number` | Current remaining amount |
| `carrier` | `{ type: string; code: string }` | Carrier info if set |
| `buyerInfo` | `{ name: string; email: string }` | Buyer info if set |
| `awardType` | `InvoiceAwardType \| undefined` | Award type if won lottery |

### Methods

#### `setVoid(voidOn?: Date): void`

Marks the invoice as void (internal use).

---

## AmegoAllowance

Represents an allowance (partial refund).

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `allowanceNumber` | `string` | Allowance number |
| `allowancePrice` | `number` | Allowance amount |
| `allowancedOn` | `Date` | Allowance creation date |
| `invoiceType` | `string` | Amego type code (B0401, D0401, etc.) |
| `remainingAmount` | `number` | Remaining amount (calculated) |
| `items` | `AmegoPaymentItem[]` | Allowance line items |
| `parentInvoice` | `AmegoInvoice` | Parent invoice reference |
| `status` | `InvoiceAllowanceState` | Current allowance state |
| `invalidOn` | `Date \| null` | Invalidation date if invalidated |

### Methods

#### `invalid(): void`

Marks the allowance as invalid and updates parent invoice's `nowAmount`.

---

## Types

### AmegoPaymentItem

```typescript
interface AmegoPaymentItem {
  name: string;           // Item name (max 256 chars)
  quantity: number;       // Quantity
  unit?: string;          // Unit of measure (max 6 chars, optional)
  unitPrice: number;      // Unit price
  remark?: string;        // Item remark (max 40 chars)
  taxType: TaxType.TAXED | TaxType.TAX_FREE | TaxType.ZERO_TAX;  // Required, only these 3 types
}
```

**Note:** `taxType` is required for each item and only accepts `TAXED`, `TAX_FREE`, or `ZERO_TAX`.

### AmegoAllowanceType

```typescript
enum AmegoAllowanceType {
  BUYER_ISSUED = 1,    // Buyer initiated allowance
  SELLER_ISSUED = 2,   // Seller initiated allowance (default)
}
```

### AmegoBaseUrls

```typescript
enum AmegoBaseUrls {
  DEVELOPMENT = 'https://invoice-api.amego.tw',
  PRODUCTION = 'https://invoice-api.amego.tw', // Same URL for both
}
```

### AmegoTaxType

Internal tax type mapping (used in API payloads):

```typescript
const AmegoTaxType = {
  [TaxType.TAXED]: '1',
  [TaxType.ZERO_TAX]: '2',
  [TaxType.TAX_FREE]: '3',
  [TaxType.SPECIAL]: '4',
  [TaxType.MIXED]: '9',
} as Record<TaxType, '1' | '2' | '3' | '4' | '9'>;
```

**Note:** Only `TAXED`, `ZERO_TAX`, and `TAX_FREE` can be used in payment items.

### Invoice Type Codes

Amego uses specific type codes for invoice operations:

| Code | Description |
|------|-------------|
| `A0401` | B2B Invoice Issue |
| `C0401` | B2C Invoice Issue |
| `F0401` | B2G Invoice Issue |
| `A0501` | B2B Invoice Void |
| `C0501` | B2C Invoice Void |
| `F0501` | B2G Invoice Void |
| `B0401` | B2B Allowance Issue |
| `D0401` | B2C Allowance Issue |
| `G0401` | B2G Allowance Issue |
| `B0501` | B2B Allowance Void |
| `D0501` | B2C Allowance Void |
| `G0501` | B2G Allowance Void |

---

## Constants

```typescript
const AMEGO_CONSTANTS = {
  MAX_ORDER_ID_LENGTH: 40,
  MAX_ITEM_NAME_LENGTH: 256,
  MAX_ITEM_UNIT_LENGTH: 6,
  MAX_ITEM_REMARK_LENGTH: 40,
  DEFAULT_TAX_RATE: 0.05,
  LOVE_CODE_MIN_LENGTH: 3,
  LOVE_CODE_MAX_LENGTH: 7,
};
```

---

## Complete Example

```typescript
import {
  AmegoInvoiceGateway,
  AmegoBaseUrls,
  AmegoAllowanceType,
  TaxType,
  InvoiceState,
  InvoiceCarrierType,
} from '@rytass/invoice-adapter-amego';

async function main() {
  const gateway = new AmegoInvoiceGateway({
    appKey: 'YOUR_APP_KEY',
    vatNumber: '12345678',
    baseUrl: AmegoBaseUrls.PRODUCTION,
  });

  // 1. Issue invoice (amounts are auto-calculated from items)
  const items = [
    { name: 'Premium Widget', quantity: 2, unitPrice: 500, unit: 'pcs', taxType: TaxType.TAXED },
    { name: 'Standard Widget', quantity: 3, unitPrice: 200, unit: 'pcs', taxType: TaxType.TAXED },
  ];

  const invoice = await gateway.issue({
    orderId: `ORDER-${Date.now()}`,
    taxType: TaxType.TAXED,
    detailVat: true,  // Required: prices include tax
    items,
    buyerEmail: 'customer@example.com',
    buyerName: 'John Doe',
  });

  console.log('Invoice issued:', invoice.invoiceNumber);
  console.log('Tax amount:', invoice.taxAmount);

  // 2. Query invoice
  const queriedInvoice = await gateway.query({
    orderId: invoice.orderId,
  });

  console.log('Invoice state:', queriedInvoice.state);

  // 3. Create allowance (taxType required for allowance items too)
  const allowanceInvoice = await gateway.allowance(
    invoice,
    [{ name: 'Premium Widget', quantity: 1, unitPrice: 500, unit: 'pcs', taxType: TaxType.TAXED }],
    { allowanceType: AmegoAllowanceType.SELLER_ISSUED }
  );

  console.log('Allowance created');
  console.log('Remaining amount:', allowanceInvoice.nowAmount);
  console.log('Accumulated allowances:', allowanceInvoice.accumulatedAllowances.length);

  // 4. Invalid allowance if needed
  if (allowanceInvoice.allowances.length > 0) {
    const allowance = allowanceInvoice.allowances[0];
    const afterInvalid = await gateway.invalidAllowance(allowance);
    console.log('Allowance invalidated');
  }
}

main().catch(console.error);
```

---

## Key Differences from Other Adapters

| Feature | Amego | Others |
|---------|-------|--------|
| `detailVat` parameter | Required | Not applicable |
| `taxType` on items | Required | Optional |
| Tax Amount | Auto-calculated from items | Auto-calculated |
| Tax Rate Storage | Stored in invoice | Not stored |
| Accumulated Allowances | Tracked separately | Single list |
| Invoice Type Codes | Uses MIG type codes | Provider-specific |
| Carrier | Uses `InvoiceCarrierType` enum | Varies |
| Love Code Validation | Not supported | Supported (ECPay, EZPay) |

---

## API Response Format

Amego returns structured responses:

```typescript
interface AmegoIssueInvoiceResponse {
  code: number;           // Response code (0 = success)
  msg: string;            // Response message
  invoice_number: string; // e.g., 'AB12345678'
  invoice_time: number;   // Issue timestamp (Unix timestamp in seconds)
  random_number: string;  // 4-digit random code
  barcode: string;        // Barcode data
  qrcode_left: string;    // Left QR code data
  qrcode_right: string;   // Right QR code data
  base64_data: string;    // Base64 encoded data
}
```

---

## Error Handling

```typescript
try {
  const invoice = await gateway.issue({
    orderId: 'ORDER-001',
    items: [{ name: 'Product', quantity: 1, unitPrice: 100, unit: 'pcs' }],
    salesAmount: 100,
    taxAmount: 5,
    totalAmount: 105,
  });
} catch (error) {
  console.error('Issue failed:', error.message);
  // Handle specific error codes
}
```
