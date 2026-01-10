# BankPro Invoice Adapter Reference

Complete API reference for `@rytass/invoice-adapter-bank-pro`.

## Installation

```bash
npm install @rytass/invoice-adapter-bank-pro
```

## BankProInvoiceGateway

The main gateway class for interacting with BankPro's (金財通) e-invoice API.

### Constructor

```typescript
new BankProInvoiceGateway(options: BankProInvoiceGatewayOptions)
```

**Parameters:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `user` | `string` | Yes | BankPro API username |
| `password` | `string` | Yes | BankPro API password |
| `systemOID` | `number` | Yes | System OID assigned by BankPro |
| `sellerBAN` | `string` | Yes | Seller's 8-digit VAT number |
| `baseUrl` | `string` | No | API base URL (default: development) |

**Example:**

```typescript
import { BankProInvoiceGateway, BankProBaseUrls } from '@rytass/invoice-adapter-bank-pro';

// Development
const devGateway = new BankProInvoiceGateway({
  user: 'TEST_USER',
  password: 'TEST_PASSWORD',
  systemOID: 12345,
  sellerBAN: '12345678',
});

// Production
const prodGateway = new BankProInvoiceGateway({
  user: 'YOUR_USER',
  password: 'YOUR_PASSWORD',
  systemOID: 12345,
  sellerBAN: '12345678',
  baseUrl: BankProBaseUrls.PRODUCTION,
});
```

---

### Methods

#### `issue(options: BankProInvoiceIssueOptions): Promise<BankProInvoice>`

Issues a new invoice. BankPro requires buyer email for all invoices.

**Parameters:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `orderId` | `string` | Yes | Unique order identifier |
| `items` | `BankProPaymentItem[]` | Yes | Invoice line items |
| `buyerEmail` | `string` | Yes | Buyer email (required by BankPro) |
| `sellerCode` | `string` | No | Seller code override |
| `companyName` | `string` | No | Seller company name |
| `remark` | `string` | No | Invoice remark |
| `buyerName` | `string` | No | Buyer name |
| `buyerZipCode` | `string` | No | Buyer zip code |
| `buyerAddress` | `string` | No | Buyer address |
| `buyerMobile` | `string` | No | Buyer mobile number |

**Returns:** `Promise<BankProInvoice>`

**Example:**

```typescript
import { TaxType } from '@rytass/invoice-adapter-bank-pro';

const invoice = await gateway.issue({
  orderId: 'ORDER-2024-001',
  buyerEmail: 'customer@example.com',
  buyerName: 'John Doe',
  items: [
    {
      name: 'Product A',
      quantity: 2,
      unitPrice: 100,
      unit: 'pcs',
      taxType: TaxType.TAXED,
    },
    {
      name: 'Product B',
      quantity: 1,
      unitPrice: 500,
      unit: 'item',
      id: 'PROD-B-001',        // Optional product ID
      barcode: '4710088123456', // Optional barcode
      spec: 'Large',           // Optional specification
      remark: 'Gift wrapped',  // Optional item remark
    },
  ],
});

console.log('Invoice issued:', invoice.invoiceNumber);
```

---

#### `void(invoice: BankProInvoice, options?: BankProInvoiceVoidOptions): Promise<BankProInvoice>`

Voids an existing invoice.

**Parameters:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `sellerCode` | `string` | No | Seller code override |

**Returns:** `Promise<BankProInvoice>` - Invoice with updated state

**Example:**

```typescript
const voidedInvoice = await gateway.void(invoice);
console.log(voidedInvoice.state); // InvoiceState.VOID
```

---

#### `allowance(invoice: BankProInvoice, allowanceItems: BankProPaymentItem[], options?: BankProInvoiceAllowanceOptions): Promise<BankProInvoice>`

Creates an allowance (partial refund) for an invoice.

**Parameters:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `allowanceItems` | `BankProPaymentItem[]` | Yes | Items to include in allowance |
| `options.sellerCode` | `string` | No | Seller code override |

**Returns:** `Promise<BankProInvoice>` - Invoice with added allowance

**Example:**

```typescript
const updatedInvoice = await gateway.allowance(
  invoice,
  [{ name: 'Product A', quantity: 1, unitPrice: 100, unit: 'pcs' }],
);

console.log(updatedInvoice.allowances.length);
console.log(updatedInvoice.nowAmount);
```

---

#### `invalidAllowance(allowance: BankProAllowance, options?: BankProInvoiceInvalidAllowanceOptions): Promise<BankProInvoice>`

Invalidates an existing allowance.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `allowance` | `BankProAllowance` | Yes | The allowance to invalidate |
| `options.sellerCode` | `string` | No | Seller code override |

**Returns:** `Promise<BankProInvoice>` - Parent invoice with updated allowance

**Example:**

```typescript
const allowance = invoice.allowances[0];
const updatedInvoice = await gateway.invalidAllowance(allowance);
```

---

#### `query(options: BankProInvoiceQueryArgs): Promise<BankProInvoice>`

Queries an invoice by order ID or invoice number.

**Parameters (Option 1 - by orderId):**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `orderId` | `string` | Yes | Order ID used when issuing |

**Parameters (Option 2 - by invoice number):**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `invoiceNumber` | `string` | Yes | 10-digit invoice number |

**Returns:** `Promise<BankProInvoice>`

**Example:**

```typescript
// Query by order ID
const invoice1 = await gateway.query({ orderId: 'ORDER-2024-001' });

// Query by invoice number
const invoice2 = await gateway.query({ invoiceNumber: 'AB12345678' });
```

---

#### `isMobileBarcodeValid(_code: string): Promise<boolean>`

**Note:** BankPro does not support mobile barcode validation. This method throws an error.

```typescript
// This will throw an error
await gateway.isMobileBarcodeValid('/ABC+123');
// Error: BankPro does not support mobile barcode validation
```

---

#### `isLoveCodeValid(_code: string): Promise<boolean>`

**Note:** BankPro does not support love code validation. This method throws an error.

```typescript
// This will throw an error
await gateway.isLoveCodeValid('168001');
// Error: BankPro does not support love code validation
```

---

## BankProInvoice

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
| `platformId` | `string \| undefined` | BankPro internal ID |
| `items` | `BankProPaymentItem[]` | Invoice line items |
| `allowances` | `BankProAllowance[]` | Associated allowances |
| `state` | `InvoiceState` | Current invoice state |
| `voidOn` | `Date \| null` | Void date if voided |
| `nowAmount` | `number` | Current remaining amount |

### Methods

#### `setVoid(voidOn?: Date): void`

Marks the invoice as void (internal use).

---

## BankProAllowance

Represents an allowance (partial refund).

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `allowanceNumber` | `string` | Allowance number |
| `allowancePrice` | `number` | Allowance amount |
| `allowancedOn` | `Date` | Allowance creation date |
| `remainingAmount` | `number` | Remaining amount (cached, may show warning) |
| `items` | `BankProPaymentItem[]` | Allowance line items (cached, may show warning) |
| `parentInvoice` | `BankProInvoice` | Parent invoice reference |
| `status` | `InvoiceAllowanceState` | Current allowance state |
| `invalidOn` | `Date \| null` | Invalidation date if invalidated |

### Methods

#### `invalid(): void`

Placeholder method (internal use).

---

## Types

### BankProPaymentItem

BankPro payment items support additional fields compared to other adapters:

```typescript
interface BankProPaymentItem {
  name: string;           // Item name
  unitPrice: number;      // Unit price
  quantity: number;       // Quantity
  unit?: string;          // Unit of measure
  taxType?: TaxType.TAXED | TaxType.TAX_FREE | TaxType.ZERO_TAX;  // Only these 3 types
  id?: string;            // Product ID
  barcode?: string;       // Product barcode
  spec?: string;          // Product specification
  remark?: string;        // Item remark
}
```

**Note:** BankPro only supports `TAXED`, `TAX_FREE`, and `ZERO_TAX`. `TaxType.SPECIAL` and `TaxType.MIXED` are not supported.

### BankProBaseUrls

```typescript
enum BankProBaseUrls {
  DEVELOPMENT = 'https://webtest.bpscm.com.tw/webapi/api/B2B2CWebApi',
  PRODUCTION = 'https://www.bpscm.com.tw/webapi/api/B2B2CWebApi',
}
```

### BankProInvoiceStatus

Internal status codes used by BankPro (used in API payloads):

```typescript
enum BankProInvoiceStatus {
  CREATE = '0',            // Issue new invoice
  UPDATE = '1',            // Update invoice
  DELETE = '2',            // Void invoice
  ALLOWANCE = '3',         // Create allowance
  INVALID_ALLOWANCE = '4', // Invalidate allowance
}
```

### BankProRateType

Tax rate type mapping:

```typescript
enum BankProRateType {
  TAXED = '1',      // 5% tax
  ZERO_TAX = '2',   // Zero-rated tax
  TAX_FREE = '3',   // Tax-free
}
```

---

## Validation Rules

BankPro performs extensive validation (40+ rules) before issuing invoices. Common validation errors include:

| Validation | Rule |
|------------|------|
| Order ID | Required, unique per invoice |
| Buyer Email | Required for all invoices |
| Seller BAN | Must be valid 8-digit VAT number |
| Item Name | Required, max 256 characters |
| Unit Price | Must be positive integer |
| Quantity | Must be positive integer |
| Unit | Max 6 characters |

---

## Complete Example

```typescript
import {
  BankProInvoiceGateway,
  BankProBaseUrls,
  TaxType,
  InvoiceState,
} from '@rytass/invoice-adapter-bank-pro';

async function main() {
  const gateway = new BankProInvoiceGateway({
    user: 'YOUR_USER',
    password: 'YOUR_PASSWORD',
    systemOID: 12345,
    sellerBAN: '12345678',
    baseUrl: BankProBaseUrls.PRODUCTION,
  });

  // 1. Issue invoice
  const invoice = await gateway.issue({
    orderId: `ORDER-${Date.now()}`,
    buyerEmail: 'customer@example.com',
    buyerName: 'John Doe',
    buyerMobile: '0912345678',
    items: [
      {
        name: 'Premium Widget',
        quantity: 2,
        unitPrice: 500,
        unit: 'pcs',
        taxType: TaxType.TAXED,
        id: 'WIDGET-001',
        barcode: '4710088123456',
      },
      {
        name: 'Standard Widget',
        quantity: 3,
        unitPrice: 200,
        unit: 'pcs',
        taxType: TaxType.TAXED,
      },
    ],
  });

  console.log('Invoice issued:', invoice.invoiceNumber);
  console.log('Random code:', invoice.randomCode);
  console.log('Amount:', invoice.issuedAmount);

  // 2. Query invoice
  const queriedInvoice = await gateway.query({
    orderId: invoice.orderId,
  });

  console.log('Invoice state:', queriedInvoice.state);

  // 3. Create allowance
  const allowanceInvoice = await gateway.allowance(
    invoice,
    [{ name: 'Premium Widget', quantity: 1, unitPrice: 500, unit: 'pcs' }],
  );

  console.log('Allowance created');
  console.log('Remaining amount:', allowanceInvoice.nowAmount);

  // 4. Void invoice if needed
  if (queriedInvoice.state === InvoiceState.ISSUED) {
    const voidedInvoice = await gateway.void(queriedInvoice);
    console.log('Invoice voided on:', voidedInvoice.voidOn);
  }
}

main().catch(console.error);
```

---

## Supported Carriers

BankPro supports these carrier types:

| Carrier Type | Code | Description |
|--------------|------|-------------|
| `MOBILE` | `3J0002` | Mobile barcode carrier |
| `MOICA` | `CQ0001` | Citizen digital certificate |
| `LOVE_CODE` | (DonateMark) | Love code donation |
| `MEMBER` | - | Platform member carrier |

**Note:** `PRINT` carrier is supported via `PaperInvoiceMark: 'Y'`.

---

## Key Differences from Other Adapters

| Feature | BankPro | Others |
|---------|---------|--------|
| Buyer Email | Required | Optional |
| Mobile Barcode Validation | Not supported (throws error) | Supported (ECPay, EZPay) |
| Love Code Validation | Not supported (throws error) | Supported (ECPay, EZPay) |
| Product ID/Barcode | Supported | Not supported |
| Product Specification | Supported | Not supported |
| Seller Code Override | Supported | Not applicable |
| TaxType.SPECIAL | Not supported | Supported (ECPay) |

---

## Error Handling

BankPro returns specific error messages for validation failures:

```typescript
try {
  const invoice = await gateway.issue({
    orderId: 'ORDER-001',
    // Missing required buyerEmail
    items: [{ name: 'Product', quantity: 1, unitPrice: 100 }],
  });
} catch (error) {
  console.error('Issue failed:', error.message);
  // May include: "buyerEmail is required"
}
```
