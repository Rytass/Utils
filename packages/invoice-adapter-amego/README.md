# Rytass Utils - Invoices (Amego)

A comprehensive TypeScript adapter for Amego's E-Invoice API, providing full support for Taiwan's electronic invoice system.

## Features

- [x] Issue Invoice - Create and issue electronic invoices
- [x] Void Invoice - Cancel issued invoices
- [x] Invoice Allowance - Create invoice allowances (折讓單)
- [x] Invalid Invoice Allowance - Cancel invoice allowances
- [x] Query Invoice - Retrieve invoice information by order ID or invoice number
- [x] Mobile Barcode Validation - Validate mobile carrier barcodes
- [x] Carrier Support - Full support for all carrier types (Mobile, MOICA, Platform, Love Code)
- [x] Love Code Validation - Strict validation for donation codes (3-7 digits, numbers only)
- [x] Comprehensive Error Handling - Descriptive error messages for easy debugging
- [x] 100% Test Coverage - Complete test suite with edge case coverage

## Installation

```bash
npm install @rytass/invoice-adapter-amego
```

## Quick Start

```typescript
import {
  AmegoInvoiceGateway,
  AmegoBaseUrls,
  TaxType,
  InvoiceCarrierType,
} from '@rytass/invoice-adapter-amego';

// Initialize the gateway
const gateway = new AmegoInvoiceGateway({
  appKey: 'your-app-key',
  vatNumber: 'your-vat-number',
  baseUrl: AmegoBaseUrls.PRODUCTION, // or DEVELOPMENT
});

// Issue an invoice
const invoice = await gateway.issue({
  orderId: 'ORDER001',
  items: [
    {
      name: 'Product A',
      quantity: 2,
      unitPrice: 100,
      taxType: TaxType.TAXED,
    },
  ],
  taxType: TaxType.TAXED,
  detailVat: true,
  buyerEmail: 'buyer@example.com',
});

// Query an invoice
const queriedInvoice = await gateway.query({ orderId: 'ORDER001' });

// Create allowance
const allowanceItems = [
  {
    name: 'Return Product A',
    quantity: 1,
    unitPrice: 100,
    taxType: TaxType.TAXED,
  },
];

await gateway.allowance(invoice, allowanceItems);
```

## Carrier Types

The adapter supports all Taiwan e-invoice carrier types:

### Mobile Carrier (手機條碼)

```typescript
carrier: {
  type: InvoiceCarrierType.MOBILE,
  code: '/ABC123'
}
```

### MOICA Carrier (自然人憑證)

```typescript
carrier: {
  type: InvoiceCarrierType.MOICA,
  code: 'ABC123DEF456'
}
```

### Platform Carrier (平台載具)

```typescript
carrier: {
  type: InvoiceCarrierType.PLATFORM,
  code: 'platform-specific-code'
}
```

### Love Code (愛心碼)

```typescript
carrier: {
  type: InvoiceCarrierType.LOVE_CODE,
  code: '123' // 3-7 digits, numbers only
}
```

## Error Handling

The adapter throws standard JavaScript errors with descriptive messages:

```typescript
try {
  await gateway.issue(invoiceOptions);
} catch (error) {
  console.log('Error:', error.message);
  // Examples of error messages:
  // "Order ID is required"
  // "Invalid VAT number format"
  // "Amego invoice issue failed: Invalid request"
  // "Invoice is not issued"
}
```

## Constants

The adapter exports useful constants to avoid magic numbers:

```typescript
import { AMEGO_CONSTANTS } from '@rytass/invoice-adapter-amego';

console.log(AMEGO_CONSTANTS.MAX_ORDER_ID_LENGTH); // 40
console.log(AMEGO_CONSTANTS.MAX_ITEM_NAME_LENGTH); // 256
console.log(AMEGO_CONSTANTS.DEFAULT_TAX_RATE); // 0.05
console.log(AMEGO_CONSTANTS.LOVE_CODE_MIN_LENGTH); // 3
console.log(AMEGO_CONSTANTS.LOVE_CODE_MAX_LENGTH); // 7
```

## API Reference

### AmegoInvoiceGateway

#### Constructor Options

- `appKey: string` - Your Amego API key
- `vatNumber: string` - Your company's VAT number
- `baseUrl?: AmegoBaseUrls` - API endpoint (DEVELOPMENT or PRODUCTION)

#### Methods

##### `issue(options: AmegoInvoiceIssueOptions): Promise<AmegoInvoice>`

Issues a new invoice.

##### `query(options: AmegoInvoiceQueryArgs): Promise<AmegoInvoice>`

Queries an invoice by order ID or invoice number.

##### `allowance(invoice: AmegoInvoice, items: AmegoPaymentItem[], options?: AmegoAllowanceOptions): Promise<AmegoInvoice>`

Creates an allowance for an existing invoice.

##### `invalidAllowance(allowance: AmegoAllowance): Promise<AmegoInvoice>`

Cancels an existing allowance.

##### `void(invoice: AmegoInvoice): Promise<AmegoInvoice>`

Voids an issued invoice.

##### `isMobileBarcodeValid(code: string): Promise<boolean>`

Validates a mobile carrier barcode.

## Development

### Using this package in your project

When using this package in your project:

```bash
# Install dependencies in your project
yarn install

# Run tests in your project
yarn test

# Run tests with coverage in your project
yarn test:coverage

# Build your project
yarn build
```

### Contributing to this package (Utils monorepo)

If you want to test or contribute to this package within the Utils monorepo:

```bash
# Install dependencies for the entire monorepo
yarn install

# Run tests specifically for invoice-adapter-amego
yarn test packages/invoice-adapter-amego

# Run tests with coverage for invoice-adapter-amego
yarn test:coverage packages/invoice-adapter-amego

# Build only this package (if available)
yarn build:package invoice-adapter-amego

# Or build the entire monorepo (affects all packages)
yarn build

# Lint only this package (if available)
yarn lint:package invoice-adapter-amego

# Or lint the entire monorepo (affects all packages)
yarn lint

# Type check the entire monorepo (affects all packages)
yarn type-check
```

For more information about contributing, please refer to the main repository documentation.

## License

MIT
