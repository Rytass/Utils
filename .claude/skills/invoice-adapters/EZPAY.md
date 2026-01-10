# EZPay Invoice Adapter Reference

Complete API reference for `@rytass/invoice-adapter-ezpay`.

## Installation

```bash
npm install @rytass/invoice-adapter-ezpay
```

## EZPayInvoiceGateway

The main gateway class for interacting with EZPay's (藍新科技) e-invoice API.

### Constructor

```typescript
new EZPayInvoiceGateway(options?: EZPayInvoiceGatewayOptions)
```

**Parameters:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `merchantId` | `string` | No | EZPay merchant ID (default: test credentials) |
| `hashKey` | `string` | No | Hash key for encryption (default: test credentials) |
| `hashIv` | `string` | No | Hash IV for encryption (default: test credentials) |
| `baseUrl` | `string` | No | API base URL (default: development) |

**Example:**

```typescript
import { EZPayInvoiceGateway, EZPayBaseUrls } from '@rytass/invoice-adapter-ezpay';

// Development (uses test credentials)
const devGateway = new EZPayInvoiceGateway();

// Production
const prodGateway = new EZPayInvoiceGateway({
  merchantId: 'YOUR_MERCHANT_ID',
  hashKey: 'YOUR_HASH_KEY',
  hashIv: 'YOUR_HASH_IV',
  baseUrl: EZPayBaseUrls.PRODUCTION,
});
```

---

### Methods

#### `issue(options: EZPayInvoiceIssueOptions): Promise<EZPayInvoice>`

Issues a new invoice. Supports both B2C and B2B invoices.

**B2C Invoice Parameters:**

| Option               | Type                   | Required | Description                                       |
|----------------------|------------------------|----------|---------------------------------------------------|
| `orderId`            | `string`               | Yes      | Unique order ID (alphanumeric + underscore, max 20 chars) |
| `items`              | `EZPayPaymentItem[]`   | Yes      | Invoice line items                                |
| `carrier`            | `EZPayAvailableCarrier`| Yes      | Carrier type (see below)                          |
| `buyerName`          | `string`               | Yes      | Buyer name (max 30 chars for B2C)                 |
| `buyerEmail`         | `string`               | No*      | Buyer email (*required for PLATFORM carrier)      |
| `ezPayTransNumber`   | `string`               | No       | EZPay transaction number                          |
| `specialTaxPercentage`| `number`              | No       | Special tax percentage (e.g., 18 for 18%)         |
| `remark`             | `string`               | No       | Invoice remark (max 200 chars)                    |
| `customsMark`        | `CustomsMark`          | No       | Customs mark for zero-tax items                   |

**B2B Invoice Parameters:**

| Option               | Type                 | Required | Description                                       |
|----------------------|----------------------|----------|---------------------------------------------------|
| `orderId`            | `string`             | Yes      | Unique order ID (alphanumeric + underscore, max 20 chars) |
| `items`              | `EZPayPaymentItem[]` | Yes      | Invoice line items                                |
| `vatNumber`          | `string`             | Yes      | Buyer's VAT number (8 digits)                     |
| `carrier`            | `InvoicePrintCarrier`| Yes      | Must be PRINT carrier for B2B                     |
| `buyerName`          | `string`             | Yes      | Buyer company name (max 60 chars, or uses vatNumber) |
| `buyerEmail`         | `string`             | No       | Buyer email for notification                      |
| `buyerAddress`       | `string`             | No       | Buyer address                                     |
| `ezPayTransNumber`   | `string`             | No       | EZPay transaction number                          |
| `specialTaxPercentage`| `number`            | No       | Special tax percentage                            |
| `remark`             | `string`             | No       | Invoice remark (max 200 chars)                    |

**Validation Rules:**
- `orderId` must be alphanumeric or underscore only, max 20 characters
- B2C `buyerName` max 30 characters
- B2B `buyerName` max 60 characters (uses vatNumber if exceeded)
- If `vatNumber` provided, `carrier` must be `PRINT`
- If `carrier` is `PLATFORM`, `buyerEmail` is required
- EZPay does not support `TaxType.SPECIAL`
- B2B does not support `TaxType.MIXED`

**Returns:** `Promise<EZPayInvoice>`

**Example:**

```typescript
import { InvoiceCarrierType, TaxType } from '@rytass/invoice-adapter-ezpay';

// B2C invoice with mobile carrier
const b2cInvoice = await gateway.issue({
  orderId: 'ORDER-2024-001',
  carrier: { type: InvoiceCarrierType.MOBILE, code: '/ABC+123' },
  items: [
    {
      name: 'Product A',
      quantity: 2,
      unitPrice: 100,
      unit: 'pcs',
      taxType: TaxType.TAXED,
    },
  ],
  buyerEmail: 'customer@example.com',
});

// B2C invoice with platform carrier
const platformInvoice = await gateway.issue({
  orderId: 'ORDER-2024-002',
  carrier: { type: InvoiceCarrierType.PLATFORM, code: '' },
  items: [
    { name: 'Product B', quantity: 1, unitPrice: 500, unit: 'item' },
  ],
});

// B2B invoice
const b2bInvoice = await gateway.issue({
  orderId: 'ORDER-2024-003',
  vatNumber: '12345678',
  carrier: { type: InvoiceCarrierType.PRINT },
  buyerName: 'Company Ltd.',
  buyerAddress: '台北市中正區重慶南路一段',
  items: [
    { name: 'Service Fee', quantity: 1, unitPrice: 10000, unit: 'item' },
  ],
});

// Invoice with love code donation
const donationInvoice = await gateway.issue({
  orderId: 'ORDER-2024-004',
  carrier: { type: InvoiceCarrierType.LOVE_CODE, code: '168001' },
  items: [
    { name: 'Donation Item', quantity: 1, unitPrice: 500, unit: 'item' },
  ],
});
```

---

#### `void(invoice: EZPayInvoice, options: EZPayInvoiceVoidOptions): Promise<EZPayInvoice>`

Voids an existing invoice.

**Parameters:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `reason` | `string` | Yes | Reason for voiding the invoice |

**Returns:** `Promise<EZPayInvoice>` - Invoice with updated state

**Example:**

```typescript
const voidedInvoice = await gateway.void(invoice, {
  reason: 'Customer requested refund',
});

console.log(voidedInvoice.state); // InvoiceState.VOID
```

---

#### `allowance(invoice: EZPayInvoice, allowanceItems: EZPayPaymentItem[], options?: EZPayInvoiceAllowanceOptions): Promise<EZPayInvoice>`

Creates an allowance (partial refund) for an invoice.

**Parameters:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `allowanceItems` | `EZPayPaymentItem[]` | Yes | Items to include in allowance |
| `options.taxType` | `TaxType` | No | Tax type for allowance |
| `options.buyerEmail` | `string` | No | Email notification |

**Returns:** `Promise<EZPayInvoice>` - Invoice with added allowance

**Example:**

```typescript
const updatedInvoice = await gateway.allowance(
  invoice,
  [{ name: 'Product A', quantity: 1, unitPrice: 100, unit: 'pcs' }],
  { buyerEmail: 'customer@example.com' }
);

console.log(updatedInvoice.allowances.length); // 1
console.log(updatedInvoice.nowAmount); // Remaining amount
```

---

#### `invalidAllowance(allowance: EZPayInvoiceAllowance, reason?: string): Promise<EZPayInvoice>`

Invalidates an existing allowance.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `allowance` | `EZPayInvoiceAllowance` | Yes | The allowance to invalidate |
| `reason` | `string` | No | Reason for invalidation |

**Returns:** `Promise<EZPayInvoice>` - Parent invoice with updated allowance

**Example:**

```typescript
const allowance = invoice.allowances[0];
const updatedInvoice = await gateway.invalidAllowance(allowance, 'Incorrect amount');
```

---

#### `query(options: EZPayInvoiceQueryOptions): Promise<EZPayInvoice>`

Queries an invoice by invoice number or order ID.

**Parameters (Option 1 - by invoice number):**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `invoiceNumber` | `string` | Yes | 10-digit invoice number |
| `randomCode` | `string` | Yes | 4-digit random code |

**Parameters (Option 2 - by order ID):**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `orderId` | `string` | Yes | Order ID used when issuing |
| `amount` | `number` | Yes | Invoice amount for verification |

**Returns:** `Promise<EZPayInvoice>`

**Example:**

```typescript
// Query by invoice number
const invoice1 = await gateway.query({
  invoiceNumber: 'AB12345678',
  randomCode: '1234',
});

// Query by order ID
const invoice2 = await gateway.query({
  orderId: 'ORDER-2024-001',
  amount: 200,
});
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
```

---

#### `isLoveCodeValid(code: string): Promise<boolean>`

Validates a love code (donation code).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | `string` | Yes | Love code (3-7 digits) |

**Returns:** `Promise<boolean>`

**Example:**

```typescript
const isValid = await gateway.isLoveCodeValid('168001');
```

---

## EZPayInvoice

Represents an issued invoice.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `invoiceNumber` | `string` | 10-digit invoice number |
| `randomCode` | `string` | 4-digit random code |
| `issuedOn` | `Date` | Invoice issue date |
| `issuedAmount` | `number` | Original invoice amount |
| `orderId` | `string` | Related order ID |
| `taxType` | `TaxType` | Tax type of the invoice |
| `platformId` | `string \| undefined` | EZPay internal transaction number |
| `items` | `EZPayPaymentItem[]` | Invoice line items |
| `allowances` | `EZPayInvoiceAllowance[]` | Associated allowances |
| `state` | `InvoiceState` | Current invoice state |
| `voidOn` | `Date \| null` | Void date if voided |
| `nowAmount` | `number` | Current remaining amount |

### Methods

#### `setVoid(voidOn?: Date): void`

Marks the invoice as void (internal use).

---

## EZPayInvoiceAllowance

Represents an allowance (partial refund).

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `allowanceNumber` | `string` | Allowance number |
| `allowancePrice` | `number` | Allowance amount |
| `allowancedOn` | `Date` | Allowance creation date |
| `remainingAmount` | `number` | Remaining amount after allowance |
| `items` | `EZPayPaymentItem[]` | Allowance line items |
| `parentInvoice` | `EZPayInvoice` | Parent invoice reference |
| `status` | `InvoiceAllowanceState` | Current allowance state |
| `invalidOn` | `Date \| null` | Invalidation date if invalidated |

### Methods

#### `invalid(invalidOn?: Date): void`

Marks the allowance as invalid (internal use).

---

## Types

### EZPayPaymentItem

```typescript
interface EZPayPaymentItem {
  name: string;           // Item name (max 256 chars)
  unitPrice: number;      // Unit price
  quantity: number;       // Quantity
  unit?: string;          // Unit of measure (max 6 chars)
  taxType?: TaxType;      // Tax type for this item
  remark?: string;        // Item remark
}
```

### EZPayAvailableCarrier

Available carrier types:

```typescript
type EZPayAvailableCarrier =
  | InvoicePrintCarrier      // Print physical invoice
  | InvoiceLoveCodeCarrier   // Love code donation
  | InvoiceMobileCarrier     // Mobile barcode carrier
  | InvoiceMoicaCarrier      // Citizen digital certificate
  | InvoicePlatformCarrier;  // Platform member carrier
```

### Carrier Examples

```typescript
import { InvoiceCarrierType } from '@rytass/invoice-adapter-ezpay';

// Mobile carrier
const mobile = { type: InvoiceCarrierType.MOBILE, code: '/ABC+123' };

// MOICA carrier
const moica = { type: InvoiceCarrierType.MOICA, code: 'AB12345678901234' };

// Platform carrier
const platform = { type: InvoiceCarrierType.PLATFORM, code: '' };

// Love code carrier
const loveCode = { type: InvoiceCarrierType.LOVE_CODE, code: '168001' };

// Print carrier (for B2B)
const print = { type: InvoiceCarrierType.PRINT };
```

### EZPayBaseUrls

```typescript
enum EZPayBaseUrls {
  DEVELOPMENT = 'https://cinv.ezpay.com.tw',
  PRODUCTION = 'https://inv.ezpay.com.tw',
}
```

### EZPayInvoiceIssueStatus

```typescript
enum EZPayInvoiceIssueStatus {
  INSTANT = '1',   // Issue immediately
  WAITING = '0',   // Waiting for processing
  DELAY = '3',     // Delayed issue
}
```

---

## Complete Example

```typescript
import {
  EZPayInvoiceGateway,
  EZPayBaseUrls,
  InvoiceCarrierType,
  TaxType,
  InvoiceState,
} from '@rytass/invoice-adapter-ezpay';

async function main() {
  const gateway = new EZPayInvoiceGateway({
    merchantId: 'YOUR_MERCHANT_ID',
    hashKey: 'YOUR_HASH_KEY',
    hashIv: 'YOUR_HASH_IV',
    baseUrl: EZPayBaseUrls.PRODUCTION,
  });

  // 1. Validate carrier before issuing
  const isValidCarrier = await gateway.isMobileBarcodeValid('/ABC+123');
  if (!isValidCarrier) {
    throw new Error('Invalid mobile barcode');
  }

  // 2. Issue B2C invoice
  const invoice = await gateway.issue({
    orderId: `ORDER-${Date.now()}`,
    carrier: { type: InvoiceCarrierType.MOBILE, code: '/ABC+123' },
    buyerEmail: 'customer@example.com',
    items: [
      {
        name: 'Premium Widget',
        quantity: 2,
        unitPrice: 500,
        unit: 'pcs',
        taxType: TaxType.TAXED,
      },
    ],
  });

  console.log('Invoice issued:', invoice.invoiceNumber);
  console.log('Platform ID:', invoice.platformId);

  // 3. Create allowance
  const allowanceInvoice = await gateway.allowance(
    invoice,
    [{ name: 'Premium Widget', quantity: 1, unitPrice: 500, unit: 'pcs' }],
  );

  console.log('Allowance created');
  console.log('Remaining:', allowanceInvoice.nowAmount);

  // 4. Query by order ID
  const queriedInvoice = await gateway.query({
    orderId: invoice.orderId,
    amount: invoice.issuedAmount,
  });

  console.log('Queried state:', queriedInvoice.state);

  // 5. Void if needed
  if (queriedInvoice.state !== InvoiceState.VOID) {
    const voidedInvoice = await gateway.void(queriedInvoice, {
      reason: 'Order cancelled',
    });
    console.log('Invoice voided');
  }
}

main().catch(console.error);
```

---

## Error Codes

EZPay returns specific error codes for different failure scenarios:

| Code | Description |
|------|-------------|
| `LIB10001` | System error |
| `LIB10002` | Missing required parameter |
| `LIB10003` | Invalid parameter format |
| `LIB10004` | Invalid merchant |
| `LIB10005` | Invalid checksum |
| `LIB10006` | Invoice already exists |
| `LIB10007` | Invoice not found |
| `LIB10008` | Invoice already voided |
| `LIB10009` | Allowance exceeds invoice amount |
| `LIB10010` | Invalid carrier code |

Handle errors appropriately in your application:

```typescript
try {
  const invoice = await gateway.issue({ /* options */ });
} catch (error) {
  if (error.message.includes('LIB10006')) {
    console.log('Invoice already exists for this order');
  } else {
    throw error;
  }
}
```
