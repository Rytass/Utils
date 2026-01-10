# Base Interfaces Reference

Complete type definitions for the `@rytass/invoice` package.

## Core Interfaces

### Invoice\<Item\>

The main invoice entity interface that all invoice implementations must satisfy.

```typescript
interface Invoice<Item extends PaymentItem> {
  // Read-only properties
  readonly invoiceNumber: string;  // 10-digit invoice number (e.g., 'AB12345678')
  readonly issuedOn: Date;         // Issue date/time
  readonly allowances: InvoiceAllowance<PaymentItem>[]; // Associated allowances
  readonly issuedAmount: number;   // Original total amount
  readonly randomCode: string;     // 4-digit random verification code
  readonly items: Item[];          // Invoice line items

  // Mutable properties
  state: InvoiceState;             // Current state (ISSUED, VOID, etc.)
  nowAmount: number;               // Current remaining amount after allowances
  voidOn: Date | null;             // Void date (null if not voided)

  // Methods
  setVoid: () => void;             // Mark invoice as void

  // Optional properties
  awardType?: InvoiceAwardType;    // Award type if invoice won lottery
}
```

---

### InvoiceGateway\<Item, I, QueryOptions\>

The gateway interface defining all operations an adapter must implement.

```typescript
interface InvoiceGateway<
  Item extends PaymentItem = PaymentItem,
  I extends Invoice<Item> = Invoice<Item>,
  QueryOptions = unknown,
> {
  /**
   * Issue a new invoice
   * @param options - Issue configuration including items, carrier, etc.
   * @returns Promise resolving to the issued invoice
   */
  issue(options: InvoiceIssueOptions<Item>): Promise<I>;

  /**
   * Void an existing invoice
   * @param invoice - The invoice to void
   * @param options - Void options including reason
   * @returns Promise resolving to the voided invoice
   */
  void(
    invoice: Invoice<PaymentItem>,
    options: InvoiceVoidOptions
  ): Promise<Invoice<PaymentItem>>;

  /**
   * Create an allowance (partial refund)
   * @param invoice - The parent invoice
   * @param allowanceItems - Items to include in the allowance
   * @param options - Optional allowance configuration
   * @returns Promise resolving to the updated invoice
   */
  allowance(
    invoice: Invoice<PaymentItem>,
    allowanceItems: InvoicePaymentItem[],
    options?: InvoiceAllowanceOptions
  ): Promise<Invoice<PaymentItem>>;

  /**
   * Invalidate an existing allowance
   * @param allowance - The allowance to invalidate
   * @returns Promise resolving to the parent invoice
   */
  invalidAllowance(
    allowance: InvoiceAllowance<PaymentItem>
  ): Promise<Invoice<PaymentItem>>;

  /**
   * Query an invoice by provider-specific options
   * @param options - Query parameters (varies by provider)
   * @returns Promise resolving to the found invoice
   */
  query(options: QueryOptions): Promise<I>;

  /**
   * Validate a mobile barcode carrier code
   * @param code - Mobile barcode (e.g., '/ABC+123')
   * @returns Promise resolving to validation result
   */
  isMobileBarcodeValid(code: string): Promise<boolean>;

  /**
   * Validate a love code (donation code)
   * @param code - Love code (3-7 digits)
   * @returns Promise resolving to validation result
   */
  isLoveCodeValid(code: string): Promise<boolean>;
}
```

---

### InvoiceAllowance\<Item\>

The allowance entity interface for partial refunds.

```typescript
interface InvoiceAllowance<Item extends PaymentItem> {
  // Read-only properties
  readonly allowanceNumber: string;     // Unique allowance identifier
  readonly allowancePrice: number;      // Allowance amount
  readonly allowancedOn: Date;          // Allowance creation date
  readonly remainingAmount: number;     // Amount remaining after this allowance
  readonly items: Item[];               // Items included in allowance
  readonly parentInvoice: Invoice<Item>; // Reference to parent invoice

  // Mutable properties
  status: InvoiceAllowanceState;        // Current state (ISSUED, INVALID)
  invalidOn: Date | null;               // Invalidation date (null if valid)

  // Methods
  invalid: () => void;                  // Mark allowance as invalid
}
```

---

## Enums

### TaxType

Tax classification for invoices and items.

```typescript
enum TaxType {
  TAXED = 'TAXED',           // Standard 5% tax rate
  TAX_FREE = 'TAX_FREE',     // Tax-exempt items
  ZERO_TAX = 'ZERO_TAX',     // Zero-rated tax (e.g., exports)
  SPECIAL = 'SPECIAL',       // Special tax rate
  MIXED = 'MIXED',           // Mixed tax types in single invoice
}
```

### SpecialTaxCode

Special tax codes for specific industries.

```typescript
enum SpecialTaxCode {
  TEA = 1,                         // Tea house
  CLUB = 2,                        // Night club
  BANK_SELF = 3,                   // Bank self-use
  INSURANCE = 4,                   // Insurance
  BANK_COMMON = 5,                 // Bank common
  BANK_SELF_SALES_BEFORE_103 = 6,  // Bank self sales (before 2014)
  BANK_SELF_SALES_AFTER_103 = 7,   // Bank self sales (after 2014)
  FREE = 8,                        // Free items
}
```

### InvoiceState

Current state of an invoice.

```typescript
enum InvoiceState {
  INITED = 'INITED',         // Initialized but not issued
  ISSUED = 'ISSUED',         // Successfully issued
  VOID = 'VOID',             // Voided/cancelled
  ALLOWANCED = 'ALLOWANCED', // Has allowances applied
}
```

### InvoiceAllowanceState

Current state of an allowance.

```typescript
enum InvoiceAllowanceState {
  INITED = 'INITED',     // Initialized but not issued
  ISSUED = 'ISSUED',     // Successfully issued
  INVALID = 'INVALID',   // Invalidated/cancelled
}
```

### InvoiceCarrierType

Types of invoice carriers (storage methods).

```typescript
enum InvoiceCarrierType {
  PRINT = 'PRINT',         // Physical printed invoice
  MOBILE = 'MOBILE',       // Mobile barcode carrier
  MOICA = 'MOICA',         // Citizen digital certificate
  LOVE_CODE = 'LOVE_CODE', // Donate to charity
  MEMBER = 'MEMBER',       // Member carrier (store-specific)
  PLATFORM = 'PLATFORM',   // Platform carrier (e-commerce)
}
```

### CustomsMark

Customs declaration mark for cross-border items.

```typescript
enum CustomsMark {
  YES = 'YES',   // Has customs declaration
  NO = 'NO',     // No customs declaration
}
```

### InvoiceAwardType

Lottery award types for Taiwan uniform invoice lottery.

```typescript
enum InvoiceAwardType {
  TWO_HUNDRED = 6,              // NT$200
  FIVE_HUNDRED = 11,            // NT$500
  EIGHT_HUNDRED = 12,           // NT$800
  ONE_THOUSAND = 5,             // NT$1,000
  CLOUD_TWO_THOUSAND = 9,       // NT$2,000 (cloud invoice)
  FOUR_THOUSAND = 4,            // NT$4,000
  TEN_THOUSAND = 3,             // NT$10,000
  FORTY_THOUSAND = 2,           // NT$40,000
  TWO_HUNDRED_THOUSAND = 1,     // NT$200,000
  ONE_MILLION = 10,             // NT$1,000,000
  TWO_MILLION = 7,              // NT$2,000,000
  TEN_MILLION = 8,              // NT$10,000,000 (special prize)
}
```

---

## Carrier Types

### InvoiceCarrierBase

Base interface for all carrier types.

```typescript
interface InvoiceCarrierBase {
  type: InvoiceCarrierType;
}
```

### Specific Carrier Types

```typescript
// Physical printed invoice
interface InvoicePrintCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.PRINT;
}

// Mobile barcode carrier
interface InvoiceMobileCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.MOBILE;
  code: string;  // e.g., '/ABC+123'
}

// Citizen digital certificate
interface InvoiceMoicaCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.MOICA;
  code: string;  // 16-character certificate code
}

// Love code donation
interface InvoiceLoveCodeCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.LOVE_CODE;
  code: string;  // 3-7 digit love code
}

// Member carrier
interface InvoiceMemberCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.MEMBER;
  code: string;
}

// Platform carrier
interface InvoicePlatformCarrier extends InvoiceCarrierBase {
  type: InvoiceCarrierType.PLATFORM;
  code: string;
}

// Discriminated union of all carrier types
type InvoiceCarrier =
  | InvoicePrintCarrier
  | InvoiceMobileCarrier
  | InvoiceMoicaCarrier
  | InvoiceLoveCodeCarrier
  | InvoiceMemberCarrier
  | InvoicePlatformCarrier;
```

---

## Options Interfaces

### InvoiceIssueOptions

Options for issuing an invoice.

```typescript
interface InvoiceIssueOptions<Item extends PaymentItem = PaymentItem> {
  items: InvoicePaymentItem<Item>[];  // Line items
  vatNumber?: string;                  // Buyer VAT number (for B2B)
  carrier?: InvoiceCarrier;            // Carrier configuration
  customsMark?: CustomsMark;           // Customs declaration mark
}
```

### InvoiceVoidOptions

Options for voiding an invoice.

```typescript
interface InvoiceVoidOptions {
  reason: string;  // Reason for voiding
}
```

### InvoiceAllowanceOptions

Options for creating an allowance.

```typescript
interface InvoiceAllowanceOptions {
  taxType?: Omit<TaxType, TaxType.MIXED | TaxType.SPECIAL>;
}
```

### BaseInvoiceQueryOptions

Base query options (extended by adapters).

```typescript
interface BaseInvoiceQueryOptions {
  orderId?: string;
  invoiceNumber?: string;
  [key: string]: unknown;
}
```

---

## Type Aliases

### PaymentItem

Base payment item type (from `@rytass/payments`).

```typescript
type PaymentItem = {
  name: string;
  unitPrice: number;
  quantity: number;
  // Additional fields defined by adapters
};
```

### InvoicePaymentItem

Payment item with optional tax type.

```typescript
type InvoicePaymentItem<Item extends PaymentItem = PaymentItem> = Item & {
  taxType?: Omit<TaxType, TaxType.MIXED>;
};
```

### InvoiceTax

Tax configuration type.

```typescript
type CommonTax = TaxBase & {
  type: Exclude<TaxType, TaxType.SPECIAL>;
};

type SpecialTax = TaxBase & {
  type: TaxType.SPECIAL;
  taxCode: SpecialTaxCode;
};

type InvoiceTax = CommonTax | SpecialTax;
```

---

## Utility Functions

### isValidVATNumber

Validates a Taiwan VAT number (營業稅籍編號).

```typescript
function isValidVATNumber(input: string | number): boolean;
```

**Parameters:**
- `input` - 8-digit VAT number as string or number

**Returns:** `true` if valid, `false` otherwise

**Example:**

```typescript
import { isValidVATNumber } from '@rytass/invoice';

isValidVATNumber('12345678');  // true or false
isValidVATNumber(12345678);    // also accepts numbers
```

### getTaxTypeFromItems

Determines the appropriate TaxType based on item tax types.

```typescript
function getTaxTypeFromItems(items: InvoicePaymentItem[]): TaxType;
```

**Parameters:**
- `items` - Array of payment items with tax types

**Returns:** Appropriate TaxType for the invoice

**Throws:** Error if items contain both ZERO_TAX and TAX_FREE

**Example:**

```typescript
import { getTaxTypeFromItems, TaxType } from '@rytass/invoice';

const items = [
  { name: 'A', unitPrice: 100, quantity: 1, taxType: TaxType.TAXED },
  { name: 'B', unitPrice: 200, quantity: 1, taxType: TaxType.TAXED },
];

const taxType = getTaxTypeFromItems(items); // TaxType.TAXED
```

### verifyVatNumber (Deprecated)

Deprecated alias for `isValidVATNumber`. Issues console warning on use.

```typescript
function verifyVatNumber(input: string | number): boolean;
```

---

## Constants

### InvoiceCarriers

Helper object for creating carrier configurations.

```typescript
const InvoiceCarriers = {
  // Static carriers
  PRINT: { type: InvoiceCarrierType.PRINT } as InvoicePrintCarrier,
  MEMBER: { type: InvoiceCarrierType.MEMBER } as InvoiceMemberCarrier,
  PLATFORM: { type: InvoiceCarrierType.PLATFORM } as InvoicePlatformCarrier,

  // Factory functions
  LOVE_CODE: (loveCode: string): InvoiceLoveCodeCarrier => ({
    type: InvoiceCarrierType.LOVE_CODE,
    code: loveCode,
  }),

  MOBILE: (barcode: string): InvoiceMobileCarrier => ({
    type: InvoiceCarrierType.MOBILE,
    code: barcode,
  }),

  MOICA: (barcode: string): InvoiceMoicaCarrier => ({
    type: InvoiceCarrierType.MOICA,
    code: barcode,
  }),
};
```

**Usage:**

```typescript
import { InvoiceCarriers } from '@rytass/invoice';

// Print carrier
const print = InvoiceCarriers.PRINT;

// Mobile barcode
const mobile = InvoiceCarriers.MOBILE('/ABC+123');

// Love code donation
const loveCode = InvoiceCarriers.LOVE_CODE('168001');

// Citizen digital certificate
const moica = InvoiceCarriers.MOICA('AB12345678901234');
```

---

## Export Structure

The package exports all types from a single entry point:

```typescript
// src/index.ts
export * from './typings';           // Enums and type definitions
export * from './invoice';           // Invoice interface
export * from './invoice-allowance'; // InvoiceAllowance interface
export * from './invoice-gateway';   // InvoiceGateway and options
export * from './utils/vat-number';  // VAT validation
export * from './utils/tax-type';    // Tax type utilities
export type { PaymentItem } from '@rytass/payments';
```
