# ECPay Invoice Adapter Reference

Complete API reference for `@rytass/invoice-adapter-ecpay`.

## Installation

```bash
npm install @rytass/invoice-adapter-ecpay
```

## ECPayInvoiceGateway

The main gateway class for interacting with ECPay's e-invoice API.

### Constructor

```typescript
new ECPayInvoiceGateway(options?: ECPayInvoiceGatewayOptions)
```

**Parameters:**

| Option                       | Type             | Required | Description                                       |
|------------------------------|------------------|----------|---------------------------------------------------|
| `merchantId`                 | `string`         | No       | ECPay merchant ID (default: test credentials)     |
| `aesKey`                     | `string`         | No       | AES encryption key (default: test credentials)    |
| `aesIv`                      | `string`         | No       | AES initialization vector (default: test credentials) |
| `baseUrl`                    | `ECPayBaseUrls`  | No       | API base URL (default: development)               |
| `skipMobileBarcodeValidation`| `boolean`        | No       | Skip mobile barcode validation (default: false)   |
| `skipLoveCodeValidation`     | `boolean`        | No       | Skip love code validation (default: false)        |

**Example:**

```typescript
import { ECPayInvoiceGateway, ECPayBaseUrls } from '@rytass/invoice-adapter-ecpay';

// Development (uses test credentials)
const devGateway = new ECPayInvoiceGateway();

// Production
const prodGateway = new ECPayInvoiceGateway({
  merchantId: '2000132',
  aesKey: 'ejCk326UnaZWKisg',
  aesIv: 'q9jcZX8Ib9LM8wYk',
  baseUrl: ECPayBaseUrls.PRODUCTION,
});
```

---

### Methods

#### `issue(options: ECPayInvoiceIssueOptions): Promise<ECPayInvoice>`

Issues a new invoice.

**Parameters:**

| Option          | Type                | Required | Description                                      |
|-----------------|---------------------|----------|--------------------------------------------------|
| `orderId`       | `string`            | Yes      | Unique order identifier (max 30 chars, alphanumeric only) |
| `items`         | `ECPayPaymentItem[]`| Yes      | Invoice line items                               |
| `customer`      | `ECPayCustomerInfo` | Yes      | Customer information (see below)                 |
| `carrier`       | `InvoiceCarrier`    | No       | Carrier type for invoices                        |
| `vatNumber`     | `string`            | No       | Buyer's VAT number for B2B invoices (8 digits)   |
| `customsMark`   | `CustomsMark`       | No       | Customs mark for tax-free items                  |
| `specialTaxCode`| `SpecialTaxCode`    | No       | Special tax code (required for special tax items)|
| `remark`        | `string`            | No       | Invoice remark                                   |

**ECPayCustomerInfo:**

| Field     | Type     | Required                        | Description                              |
|-----------|----------|---------------------------------|------------------------------------------|
| `id`      | `string` | No                              | Customer ID (max 20 chars)               |
| `name`    | `string` | Yes (if vatNumber or PRINT)     | Customer/Company name                    |
| `address` | `string` | Yes (if PRINT carrier)          | Customer address                         |
| `mobile`  | `string` | Yes (one of mobile or email)    | Mobile number (digits only)              |
| `email`   | `string` | Yes (one of mobile or email)    | Email address                            |

**Returns:** `Promise<ECPayInvoice>`

**Validation Rules:**
- `orderId` must be alphanumeric only, max 30 characters
- Must provide at least `customer.mobile` OR `customer.email`
- If `vatNumber` provided, `carrier` must be `PRINT` and `customer.name` required
- If `carrier` is `PRINT`, both `customer.name` and `customer.address` required

**Example:**

```typescript
import { TaxType, InvoiceCarriers, CustomsMark } from '@rytass/invoice-adapter-ecpay';

// B2C invoice with mobile carrier
const b2cInvoice = await gateway.issue({
  orderId: 'ORDER2024001',
  customer: {
    email: 'customer@example.com',
  },
  carrier: InvoiceCarriers.MOBILE('/ABC+123'),
  items: [
    {
      name: 'Product A',
      quantity: 2,
      unitPrice: 100,
      unit: 'pcs',
      taxType: TaxType.TAXED,
    },
  ],
});

// B2B invoice with VAT number
const b2bInvoice = await gateway.issue({
  orderId: 'ORDER2024002',
  customer: {
    name: 'Company Ltd.',
    address: '100 Business St.',
    email: 'company@example.com',
  },
  carrier: InvoiceCarriers.PRINT,
  vatNumber: '12345678',
  items: [
    { name: 'Service Fee', quantity: 1, unitPrice: 10000, unit: 'item' },
  ],
});

// Invoice with love code donation
const donationInvoice = await gateway.issue({
  orderId: 'ORDER2024003',
  customer: {
    mobile: '0912345678',
  },
  carrier: InvoiceCarriers.LOVE_CODE('168001'),
  items: [
    { name: 'Donation Item', quantity: 1, unitPrice: 500, unit: 'item' },
  ],
});
```

---

#### `void(invoice: ECPayInvoice, options: ECPayInvoiceVoidOptions): Promise<ECPayInvoice>`

Voids an existing invoice.

**Parameters:**

| Option   | Type     | Required | Description                    |
|----------|----------|----------|--------------------------------|
| `reason` | `string` | Yes      | Reason for voiding the invoice |

**Returns:** `Promise<ECPayInvoice>` - Invoice with updated state

**Example:**

```typescript
const voidedInvoice = await gateway.void(invoice, {
  reason: 'Customer requested refund',
});

console.log(voidedInvoice.state); // InvoiceState.VOID
console.log(voidedInvoice.voidOn); // Date when voided
```

---

#### `allowance(invoice: ECPayInvoice, allowanceItems: ECPayPaymentItem[], options?: ECPayInvoiceAllowanceOptions): Promise<ECPayInvoice>`

Creates an allowance (partial refund) for an invoice.

**Parameters:**

| Option           | Type                 | Required | Description                        |
|------------------|----------------------|----------|------------------------------------|
| `allowanceItems` | `ECPayPaymentItem[]` | Yes      | Items to include in allowance      |
| `options.taxType`| `TaxType`            | No*      | Tax type (*required for MIXED tax) |
| `options.buyerName`  | `string`         | No       | Buyer name                         |
| `options.notifyEmail`| `string`         | No       | Email notification                 |
| `options.notifyPhone`| `string`         | No       | Phone notification                 |

**Returns:** `Promise<ECPayInvoice>` - Invoice with added allowance

**Example:**

```typescript
const updatedInvoice = await gateway.allowance(
  invoice,
  [{ name: 'Product A', quantity: 1, unitPrice: 100, unit: 'pcs' }],
  { notifyEmail: 'customer@example.com' }
);

console.log(updatedInvoice.allowances.length); // 1
console.log(updatedInvoice.nowAmount); // Remaining amount after allowance
```

---

#### `invalidAllowance(allowance: ECPayInvoiceAllowance, reason?: string): Promise<ECPayInvoice>`

Invalidates an existing allowance.

**Parameters:**

| Parameter   | Type                    | Required | Description                    |
|-------------|-------------------------|----------|--------------------------------|
| `allowance` | `ECPayInvoiceAllowance` | Yes      | The allowance to invalidate    |
| `reason`    | `string`                | No       | Reason (default: '作廢折讓')   |

**Returns:** `Promise<ECPayInvoice>` - Parent invoice with updated allowance

**Example:**

```typescript
const allowance = invoice.allowances[0];
const updatedInvoice = await gateway.invalidAllowance(allowance, 'Incorrect amount');

console.log(allowance.status); // InvoiceAllowanceState.INVALID
```

---

#### `query(options: ECPayInvoiceQueryOptions): Promise<ECPayInvoice>`

Queries an invoice by order ID or invoice number.

**Parameters (Option 1 - by orderId):**

| Option    | Type     | Required | Description               |
|-----------|----------|----------|---------------------------|
| `orderId` | `string` | Yes      | Order ID used when issuing|

**Parameters (Option 2 - by invoice number):**

| Option          | Type     | Required | Description                   |
|-----------------|----------|----------|-------------------------------|
| `invoiceNumber` | `string` | Yes      | 10-digit invoice number       |
| `issuedOn`      | `Date`   | Yes      | Date when invoice was issued  |

**Returns:** `Promise<ECPayInvoice>`

**Example:**

```typescript
// Query by order ID
const invoice1 = await gateway.query({ orderId: 'ORDER2024001' });

// Query by invoice number and date
const invoice2 = await gateway.query({
  invoiceNumber: 'AB12345678',
  issuedOn: new Date('2024-01-15'),
});
```

---

#### `list(options: ECPayInvoiceListQueryOptions): Promise<ECPayInvoice[]>`

Lists invoices within a date range. Automatically paginates through all results.

**Parameters:**

| Option        | Type      | Required | Description                            |
|---------------|-----------|----------|----------------------------------------|
| `startDate`   | `string`  | Yes      | Start date of range (YYYY-MM-DD)       |
| `endDate`     | `string`  | Yes      | End date of range (YYYY-MM-DD)         |
| `onlyAward`   | `boolean` | No       | Only return awarded invoices           |
| `onlyInvalid` | `boolean` | No       | Only return voided invoices            |

**Returns:** `Promise<ECPayInvoice[]>`

**Note:** List results contain compressed items. Each invoice has a single item with name `ECPAY/COMPRESS_ITEM` and randomCode `XXXX`. Use `query()` to get full item details.

**Example:**

```typescript
// List all invoices in January 2024
const invoices = await gateway.list({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
});

// List only awarded invoices
const awardedInvoices = await gateway.list({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  onlyAward: true,
});

// List only voided invoices
const voidedInvoices = await gateway.list({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  onlyInvalid: true,
});
```

---

#### `isMobileBarcodeValid(barcode: string): Promise<boolean>`

Validates a mobile barcode carrier code.

**Parameters:**

| Parameter | Type     | Required | Description                       |
|-----------|----------|----------|-----------------------------------|
| `barcode` | `string` | Yes      | Mobile barcode (format: `/[0-9A-Z+\-.]{7}$`) |

**Returns:** `Promise<boolean>`

**Example:**

```typescript
const isValid = await gateway.isMobileBarcodeValid('/ABC+123');
if (!isValid) {
  throw new Error('Invalid mobile barcode');
}
```

---

#### `isLoveCodeValid(loveCode: string): Promise<boolean>`

Validates a love code (donation code).

**Parameters:**

| Parameter  | Type     | Required | Description                |
|------------|----------|----------|----------------------------|
| `loveCode` | `string` | Yes      | Love code (3-7 digits)     |

**Returns:** `Promise<boolean>`

**Example:**

```typescript
const isValid = await gateway.isLoveCodeValid('168001');
```

---

#### `isValidGUI(gui: string): Promise<[false] | [true, string]>`

Validates a GUI (Government Uniform Invoice) number / VAT number.

**Note:** This is a supporting feature that cannot cover all companies or organizations.

**Parameters:**

| Parameter | Type     | Required | Description           |
|-----------|----------|----------|-----------------------|
| `gui`     | `string` | Yes      | 8-digit VAT number    |

**Returns:** `Promise<[false] | [true, string]>` - Returns `[true, companyName]` if valid

**Example:**

```typescript
const result = await gateway.isValidGUI('12345678');
if (result[0]) {
  console.log(`Valid VAT for company: ${result[1]}`);
}
```

---

## ECPayInvoice

Represents an issued invoice.

### Properties

| Property        | Type                     | Description                             |
|-----------------|--------------------------|-----------------------------------------|
| `invoiceNumber` | `string`                 | 10-digit invoice number (e.g., 'AB12345678') |
| `randomCode`    | `string`                 | 4-digit random code                     |
| `issuedOn`      | `Date`                   | Invoice issue date                      |
| `issuedAmount`  | `number`                 | Original invoice amount                 |
| `orderId`       | `string`                 | Related order ID                        |
| `taxType`       | `TaxType`                | Tax type of the invoice                 |
| `items`         | `ECPayPaymentItem[]`     | Invoice line items                      |
| `allowances`    | `ECPayInvoiceAllowance[]`| Associated allowances                   |
| `state`         | `InvoiceState`           | Current invoice state                   |
| `voidOn`        | `Date \| null`           | Void date if voided                     |
| `nowAmount`     | `number`                 | Current remaining amount                |
| `awardType`     | `InvoiceAwardType \| undefined` | Award type if won lottery         |

---

## ECPayInvoiceAllowance

Represents an allowance (partial refund).

### Properties

| Property          | Type                     | Description                           |
|-------------------|--------------------------|---------------------------------------|
| `allowanceNumber` | `string`                 | Allowance number                      |
| `allowancePrice`  | `number`                 | Allowance amount                      |
| `allowancedOn`    | `Date`                   | Allowance creation date               |
| `remainingAmount` | `number`                 | Remaining amount after this allowance |
| `items`           | `ECPayPaymentItem[]`     | Allowance line items                  |
| `parentInvoice`   | `ECPayInvoice`           | Parent invoice reference              |
| `status`          | `InvoiceAllowanceState`  | Current allowance state               |
| `invalidOn`       | `Date \| null`           | Invalidation date if invalidated      |

---

## Types

### ECPayPaymentItem

```typescript
interface ECPayPaymentItem {
  name: string;           // Item name (max 256 chars)
  unitPrice: number;      // Unit price (positive integer)
  quantity: number;       // Quantity (positive integer)
  unit?: string;          // Unit of measure (default: '個')
  taxType?: TaxType;      // Tax type for this item
  remark?: string;        // Item remark
}
```

### InvoiceCarriers

Helper object for creating carrier configurations:

```typescript
import { InvoiceCarriers } from '@rytass/invoice-adapter-ecpay';

// Print carrier (physical invoice)
const print = InvoiceCarriers.PRINT;

// Mobile barcode carrier
const mobile = InvoiceCarriers.MOBILE('/ABC+123');

// MOICA (citizen digital certificate)
const moica = InvoiceCarriers.MOICA('AB12345678901234');

// Love code donation
const loveCode = InvoiceCarriers.LOVE_CODE('168001');

// Member carrier
const member = InvoiceCarriers.MEMBER;

// Platform carrier
const platform = InvoiceCarriers.PLATFORM;
```

### TaxType

```typescript
enum TaxType {
  TAXED = 'TAXED',           // Taxable (5%)
  TAX_FREE = 'TAX_FREE',     // Tax-free
  ZERO_TAX = 'ZERO_TAX',     // Zero-rated tax
  SPECIAL = 'SPECIAL',       // Special tax rate
  MIXED = 'MIXED',           // Mixed tax types
}
```

### InvoiceState

```typescript
enum InvoiceState {
  INITED = 'INITED',
  ISSUED = 'ISSUED',
  VOID = 'VOID',
  ALLOWANCED = 'ALLOWANCED',
}
```

### InvoiceAllowanceState

```typescript
enum InvoiceAllowanceState {
  INITED = 'INITED',
  ISSUED = 'ISSUED',
  INVALID = 'INVALID',
}
```

### CustomsMark

```typescript
enum CustomsMark {
  YES = 'YES',  // Has customs declaration
  NO = 'NO',    // No customs declaration (default)
}
```

### SpecialTaxCode

```typescript
enum SpecialTaxCode {
  TEA = 1,                       // 茶葉
  CLUB = 2,                      // 俱樂部
  BANK_SELF = 3,                 // 銀行業自有資金
  INSURANCE = 4,                 // 保險業
  BANK_COMMON = 5,               // 銀行業一般
  BANK_SELF_SALES_BEFORE_103 = 6,// 銀行業103年前
  BANK_SELF_SALES_AFTER_103 = 7, // 銀行業103年後
  FREE = 8,                      // 免稅
}
```

### InvoiceAwardType

```typescript
enum InvoiceAwardType {
  TWO_HUNDRED = 6,           // 200 元
  ONE_THOUSAND = 5,          // 1,000 元
  FOUR_THOUSAND = 4,         // 4,000 元
  TEN_THOUSAND = 3,          // 10,000 元
  FORTY_THOUSAND = 2,        // 40,000 元
  TWO_HUNDRED_THOUSAND = 1,  // 200,000 元
  TWO_MILLION = 7,           // 2,000,000 元
  TEN_MILLION = 8,           // 10,000,000 元 (特別獎)
  CLOUD_TWO_THOUSAND = 9,    // 2,000 元 (雲端專屬獎)
  ONE_MILLION = 10,          // 1,000,000 元
  FIVE_HUNDRED = 11,         // 500 元
  EIGHT_HUNDRED = 12,        // 800 元
}
```

### ECPayBaseUrls

```typescript
enum ECPayBaseUrls {
  DEVELOPMENT = 'https://einvoice-stage.ecpay.com.tw',
  PRODUCTION = 'https://einvoice.ecpay.com.tw',
}
```

---

## Complete Example

```typescript
import {
  ECPayInvoiceGateway,
  ECPayBaseUrls,
  TaxType,
  InvoiceCarriers,
  InvoiceState,
} from '@rytass/invoice-adapter-ecpay';

async function main() {
  const gateway = new ECPayInvoiceGateway({
    merchantId: 'YOUR_MERCHANT_ID',
    aesKey: 'YOUR_AES_KEY',
    aesIv: 'YOUR_AES_IV',
    baseUrl: ECPayBaseUrls.PRODUCTION,
  });

  // 1. Validate carrier before issuing
  const isValidCarrier = await gateway.isMobileBarcodeValid('/ABC+123');
  if (!isValidCarrier) {
    throw new Error('Invalid mobile barcode');
  }

  // 2. Issue invoice
  const invoice = await gateway.issue({
    orderId: `ORDER${Date.now()}`,
    customer: {
      email: 'customer@example.com',
    },
    carrier: InvoiceCarriers.MOBILE('/ABC+123'),
    items: [
      {
        name: 'Premium Widget',
        quantity: 2,
        unitPrice: 500,
        unit: 'pcs',
        taxType: TaxType.TAXED,
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
  console.log('Amount:', invoice.issuedAmount);

  // 3. Create partial allowance
  const allowanceInvoice = await gateway.allowance(
    invoice,
    [{ name: 'Premium Widget', quantity: 1, unitPrice: 500, unit: 'pcs' }],
  );

  console.log('Allowance created');
  console.log('Remaining amount:', allowanceInvoice.nowAmount);

  // 4. Query invoice
  const queriedInvoice = await gateway.query({ orderId: invoice.orderId });
  console.log('Invoice state:', queriedInvoice.state);

  // 5. Void invoice if needed
  if (queriedInvoice.state === InvoiceState.ISSUED) {
    const voidedInvoice = await gateway.void(queriedInvoice, {
      reason: 'Order cancelled',
    });
    console.log('Invoice voided on:', voidedInvoice.voidOn);
  }
}

main().catch(console.error);
```

---

## Constants

| Constant                    | Value                 | Description                    |
|-----------------------------|-----------------------|--------------------------------|
| `ECPAY_INVOICE_SUCCESS_CODE`| `1`                   | Success response code          |
| `ECPAY_COMPRESSED_ITEM_NAME`| `'ECPAY/COMPRESS_ITEM'`| Placeholder for compressed items |
| `ECPAY_RANDOM_CODE`         | `'XXXX'`              | Placeholder random code        |
