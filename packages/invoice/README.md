# Rytass Utils - Invoice

A comprehensive TypeScript invoice management framework designed for Taiwan's electronic invoice system. Provides a unified interface for issuing, managing, and processing invoices across different service providers while maintaining compliance with Taiwan's tax regulations.

## Features

- [x] Unified invoice interface across multiple providers
- [x] Taiwan electronic invoice system compliance
- [x] Support for B2B and B2C invoice scenarios
- [x] Multiple carrier types (Mobile, MOICA, Love Code, etc.)
- [x] VAT number validation and formatting
- [x] Invoice allowance (partial refund) management
- [x] Tax type categorization and validation
- [x] Invoice state management and tracking
- [x] Customs mark support for export/import
- [x] TypeScript type safety throughout
- [x] Extensible adapter pattern architecture

## Available Adapters

This package provides the core interfaces and types. Use with specific adapter implementations:

- **[@rytass/invoice-adapter-ecpay](https://www.npmjs.com/package/@rytass/invoice-adapter-ecpay)** - ECPay electronic invoice integration
- **[@rytass/invoice-adapter-ezpay](https://www.npmjs.com/package/@rytass/invoice-adapter-ezpay)** - EZPay invoice service integration
- **[@rytass/invoice-adapter-bank-pro](https://www.npmjs.com/package/@rytass/invoice-adapter-bank-pro)** - Bank Pro invoice system integration
- **[@rytass/invoice-adapter-amego](https://www.npmjs.com/package/@rytass/invoice-adapter-amego)** - Amego invoice platform integration

## Installation

```bash
npm install @rytass/invoice
# Install a specific adapter
npm install @rytass/invoice-adapter-ecpay
# or
yarn add @rytass/invoice @rytass/invoice-adapter-ecpay
```

## Basic Usage

### Invoice Interface Implementation

```typescript
import { InvoiceGateway, InvoiceIssueOptions, InvoiceCarriers, TaxType, CustomsMark } from '@rytass/invoice';
import { ECPayInvoiceGateway } from '@rytass/invoice-adapter-ecpay';

// Initialize invoice gateway
const invoiceGateway: InvoiceGateway = new ECPayInvoiceGateway({
  hashKey: 'YOUR_HASH_KEY',
  hashIV: 'YOUR_HASH_IV',
  merchantId: 'YOUR_MERCHANT_ID',
  isProduction: false,
});

// Issue a B2C invoice
const invoice = await invoiceGateway.issue({
  items: [
    {
      name: 'Product A',
      unitPrice: 1000,
      quantity: 2,
      taxType: TaxType.TAXED,
    },
    {
      name: 'Product B',
      unitPrice: 500,
      quantity: 1,
      taxType: TaxType.TAXED,
    },
  ],
  carrier: InvoiceCarriers.MOBILE('AB12345678'), // Mobile barcode
  customsMark: CustomsMark.NO,
});

console.log('Invoice Number:', invoice.number);
console.log('Invoice State:', invoice.state);
```

### B2B Invoice with VAT Number

```typescript
const b2bInvoice = await invoiceGateway.issue({
  items: [
    {
      name: 'Professional Service',
      unitPrice: 50000,
      quantity: 1,
      taxType: TaxType.TAXED,
    },
  ],
  vatNumber: '12345678', // Company VAT number
  customsMark: CustomsMark.NO,
});
```

### Multiple Tax Types

```typescript
const mixedTaxInvoice = await invoiceGateway.issue({
  items: [
    {
      name: 'Taxed Item',
      unitPrice: 1000,
      quantity: 1,
      taxType: TaxType.TAXED, // 5% tax
    },
    {
      name: 'Tax-Free Item',
      unitPrice: 2000,
      quantity: 1,
      taxType: TaxType.TAX_FREE, // No tax
    },
    {
      name: 'Zero Tax Export',
      unitPrice: 3000,
      quantity: 1,
      taxType: TaxType.ZERO_TAX, // Export goods
    },
  ],
  carrier: InvoiceCarriers.PRINT,
  customsMark: CustomsMark.YES, // For export items
});
```

## Core Concepts

### Invoice Carriers

Taiwan's electronic invoice system supports various carrier types for different delivery methods:

```typescript
import { InvoiceCarriers, InvoiceCarrierType } from '@rytass/invoice';

// Print invoice (traditional paper receipt)
const printCarrier = InvoiceCarriers.PRINT;

// Mobile barcode carrier
const mobileCarrier = InvoiceCarriers.MOBILE('/ABC1234'); // Barcode from mobile app

// MOICA (Government digital certificate)
const moicaCarrier = InvoiceCarriers.MOICA('AB12345678901234');

// Love Code (donation to charity)
const loveCodeCarrier = InvoiceCarriers.LOVE_CODE('123');

// Member carrier (platform-specific)
const memberCarrier = { type: InvoiceCarrierType.MEMBER, code: 'member123' };

// Platform carrier (e-commerce platforms)
const platformCarrier = { type: InvoiceCarrierType.PLATFORM, code: 'platform456' };
```

### Tax Types and Categories

```typescript
import { TaxType, SpecialTaxCode } from '@rytass/invoice';

// Standard tax types
const taxedItem = {
  name: 'Regular Product',
  unitPrice: 1000,
  quantity: 1,
  taxType: TaxType.TAXED, // 5% business tax
};

const taxFreeItem = {
  name: 'Exempt Product',
  unitPrice: 1000,
  quantity: 1,
  taxType: TaxType.TAX_FREE, // Tax exempt goods
};

const zeroTaxItem = {
  name: 'Export Product',
  unitPrice: 1000,
  quantity: 1,
  taxType: TaxType.ZERO_TAX, // Export goods (0% tax)
};

// Special tax scenarios
const specialTaxItem = {
  name: 'Banking Service',
  unitPrice: 1000,
  quantity: 1,
  taxType: TaxType.SPECIAL,
  specialTaxCode: SpecialTaxCode.BANK_COMMON,
};
```

### Invoice States

```typescript
import { InvoiceState } from '@rytass/invoice';

// Invoice lifecycle states
InvoiceState.INITED; // Invoice created but not issued
InvoiceState.ISSUED; // Invoice successfully issued
InvoiceState.VOID; // Invoice voided/cancelled
InvoiceState.ALLOWANCED; // Invoice has allowances (partial refunds)
```

## Advanced Usage

### Invoice Allowances (Partial Refunds)

```typescript
// Issue original invoice
const originalInvoice = await invoiceGateway.issue({
  items: [
    {
      name: 'Product A',
      unitPrice: 1000,
      quantity: 3, // Total: 3000
      taxType: TaxType.TAXED,
    },
  ],
  carrier: InvoiceCarriers.MOBILE('/ABC1234'),
});

// Create allowance for partial refund (return 1 item)
const allowanceInvoice = await invoiceGateway.allowance(
  originalInvoice,
  [
    {
      name: 'Product A',
      unitPrice: 1000,
      quantity: 1, // Refund 1 item
      taxType: TaxType.TAXED,
    },
  ],
  {
    taxType: TaxType.TAXED, // Allowance tax type
  },
);

console.log('Allowance created:', allowanceInvoice.allowances.length);
```

### Invoice Voiding

```typescript
// Void an entire invoice
const voidedInvoice = await invoiceGateway.void(invoice, {
  reason: 'Customer requested cancellation',
});

console.log('Invoice state:', voidedInvoice.state); // InvoiceState.VOID
```

### Carrier Validation

```typescript
// Validate mobile barcode
const isMobileValid = await invoiceGateway.isMobileBarcodeValid('/ABC1234');
if (!isMobileValid) {
  throw new Error('Invalid mobile barcode');
}

// Validate love code (charity donation)
const isLoveCodeValid = await invoiceGateway.isLoveCodeValid('123');
if (!isLoveCodeValid) {
  throw new Error('Invalid love code');
}
```

### VAT Number Validation

```typescript
import { isValidVATNumber } from '@rytass/invoice';

// Validate Taiwan VAT number format
const vatNumber = '12345678';
const isValid = isValidVATNumber(vatNumber);

if (!isValid) {
  throw new Error('Invalid VAT number format');
}
```

### Tax Type Detection

```typescript
import { getTaxTypeFromItems } from '@rytass/invoice';

const items = [
  { name: 'Item 1', unitPrice: 1000, quantity: 1, taxType: TaxType.TAXED },
  { name: 'Item 2', unitPrice: 2000, quantity: 1, taxType: TaxType.TAXED },
];

// Automatically determine overall tax type for invoice
const overallTaxType = getTaxTypeFromItems(items);
console.log('Invoice tax type:', overallTaxType); // TaxType.TAXED
```

## TypeScript Integration

### Custom Payment Items

```typescript
import { InvoicePaymentItem, PaymentItem } from '@rytass/invoice';

// Extend base PaymentItem with custom properties
interface CustomPaymentItem extends PaymentItem {
  productId: string;
  category: string;
  discount?: number;
}

// Use with invoice system
interface CustomInvoiceItem extends InvoicePaymentItem<CustomPaymentItem> {
  productId: string;
  category: string;
  discount?: number;
}

const customInvoice = await invoiceGateway.issue({
  items: [
    {
      name: 'Premium Product',
      unitPrice: 1000,
      quantity: 1,
      taxType: TaxType.TAXED,
      productId: 'PROD-001',
      category: 'Electronics',
      discount: 100,
    },
  ] as CustomInvoiceItem[],
  carrier: InvoiceCarriers.PRINT,
});
```

### Generic Invoice Gateway

```typescript
import { InvoiceGateway, Invoice } from '@rytass/invoice';

// Type-safe invoice gateway
class CustomInvoiceService<T extends PaymentItem> {
  constructor(private gateway: InvoiceGateway<T>) {}

  async issueInvoice(items: InvoicePaymentItem<T>[]): Promise<Invoice<T>> {
    return this.gateway.issue({
      items,
      carrier: InvoiceCarriers.PRINT,
    });
  }

  async processRefund(invoice: Invoice<T>, refundItems: InvoicePaymentItem<T>[]): Promise<Invoice<T>> {
    return this.gateway.allowance(invoice, refundItems);
  }
}
```

## Error Handling

```typescript
import { InvoiceState } from '@rytass/invoice';

try {
  const invoice = await invoiceGateway.issue({
    items: [
      {
        name: 'Product',
        unitPrice: 1000,
        quantity: 1,
        taxType: TaxType.TAXED,
      },
    ],
    vatNumber: '12345678',
    carrier: InvoiceCarriers.MOBILE('/INVALID'),
  });
} catch (error) {
  if (error.message.includes('invalid mobile barcode')) {
    console.error('Mobile barcode validation failed');
  } else if (error.message.includes('VAT number')) {
    console.error('VAT number validation failed');
  } else if (error.message.includes('tax calculation')) {
    console.error('Tax calculation error');
  } else {
    console.error('Invoice issuance failed:', error.message);
  }
}
```

## Integration Examples

### Express.js API Endpoint

```typescript
import express from 'express';
import { ECPayInvoiceGateway } from '@rytass/invoice-adapter-ecpay';
import { InvoiceCarriers, TaxType } from '@rytass/invoice';

const app = express();
const invoiceGateway = new ECPayInvoiceGateway({
  hashKey: process.env.ECPAY_HASH_KEY!,
  hashIV: process.env.ECPAY_HASH_IV!,
  merchantId: process.env.ECPAY_MERCHANT_ID!,
  isProduction: process.env.NODE_ENV === 'production',
});

app.post('/api/invoices', async (req, res) => {
  try {
    const { items, vatNumber, carrierType, carrierCode } = req.body;

    // Determine carrier
    let carrier;
    if (carrierType === 'mobile') {
      carrier = InvoiceCarriers.MOBILE(carrierCode);
    } else if (carrierType === 'love_code') {
      carrier = InvoiceCarriers.LOVE_CODE(carrierCode);
    } else {
      carrier = InvoiceCarriers.PRINT;
    }

    // Issue invoice
    const invoice = await invoiceGateway.issue({
      items: items.map(item => ({
        ...item,
        taxType: TaxType.TAXED,
      })),
      vatNumber,
      carrier,
    });

    res.json({
      success: true,
      invoiceNumber: invoice.number,
      amount: invoice.amount,
      state: invoice.state,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});
```

### NestJS Service Integration

```typescript
import { Injectable } from '@nestjs/common';
import { InvoiceGateway, InvoiceCarriers, TaxType } from '@rytass/invoice';
import { ECPayInvoiceGateway } from '@rytass/invoice-adapter-ecpay';

@Injectable()
export class InvoiceService {
  private invoiceGateway: InvoiceGateway;

  constructor() {
    this.invoiceGateway = new ECPayInvoiceGateway({
      hashKey: process.env.ECPAY_HASH_KEY!,
      hashIV: process.env.ECPAY_HASH_IV!,
      merchantId: process.env.ECPAY_MERCHANT_ID!,
      isProduction: process.env.NODE_ENV === 'production',
    });
  }

  async createInvoiceForOrder(order: {
    items: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
    customerVat?: string;
    mobileBarcode?: string;
  }) {
    // Validate mobile barcode if provided
    if (order.mobileBarcode) {
      const isValid = await this.invoiceGateway.isMobileBarcodeValid(order.mobileBarcode);
      if (!isValid) {
        throw new Error('Invalid mobile barcode');
      }
    }

    const invoice = await this.invoiceGateway.issue({
      items: order.items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        taxType: TaxType.TAXED,
      })),
      vatNumber: order.customerVat,
      carrier: order.mobileBarcode ? InvoiceCarriers.MOBILE(order.mobileBarcode) : InvoiceCarriers.PRINT,
    });

    return {
      invoiceNumber: invoice.number,
      amount: invoice.amount,
      tax: invoice.taxAmount,
      state: invoice.state,
    };
  }

  async processRefund(
    invoiceNumber: string,
    refundItems: Array<{
      name: string;
      price: number;
      quantity: number;
    }>,
  ) {
    // Query existing invoice
    const invoice = await this.invoiceGateway.query({ number: invoiceNumber });

    // Create allowance
    const updatedInvoice = await this.invoiceGateway.allowance(
      invoice,
      refundItems.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        taxType: TaxType.TAXED,
      })),
    );

    return {
      allowances: updatedInvoice.allowances,
      state: updatedInvoice.state,
    };
  }
}
```

### E-commerce Platform Integration

```typescript
import { InvoiceGateway, InvoiceCarriers, TaxType, CustomsMark } from '@rytass/invoice';

class EcommerceInvoiceManager {
  constructor(private invoiceGateway: InvoiceGateway) {}

  async processOrderInvoice(order: {
    id: string;
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      isExport?: boolean;
    }>;
    customer: {
      vatNumber?: string;
      mobileBarcode?: string;
      email: string;
    };
  }) {
    // Determine if order contains export items
    const hasExportItems = order.items.some(item => item.isExport);

    // Map items with appropriate tax types
    const invoiceItems = order.items.map(item => ({
      name: item.name,
      unitPrice: item.price,
      quantity: item.quantity,
      taxType: item.isExport ? TaxType.ZERO_TAX : TaxType.TAXED,
    }));

    // Determine carrier based on customer preferences
    let carrier;
    if (order.customer.mobileBarcode) {
      const isValid = await this.invoiceGateway.isMobileBarcodeValid(order.customer.mobileBarcode);
      if (isValid) {
        carrier = InvoiceCarriers.MOBILE(order.customer.mobileBarcode);
      }
    }

    if (!carrier) {
      carrier = InvoiceCarriers.PRINT;
    }

    const invoice = await this.invoiceGateway.issue({
      items: invoiceItems,
      vatNumber: order.customer.vatNumber,
      carrier,
      customsMark: hasExportItems ? CustomsMark.YES : CustomsMark.NO,
    });

    // Store invoice reference with order
    await this.saveInvoiceReference(order.id, invoice.number);

    return invoice;
  }

  private async saveInvoiceReference(orderId: string, invoiceNumber: string) {
    // Implementation to store invoice-order relationship
  }
}
```

## Best Practices

### Configuration Management

- Store API credentials securely using environment variables
- Use different configurations for staging and production environments
- Implement proper error handling for credential validation

### Tax Compliance

- Always validate VAT numbers before issuing B2B invoices
- Use appropriate tax types for different product categories
- Handle export/import scenarios with proper customs marks

### State Management

- Track invoice states throughout their lifecycle
- Implement proper allowance workflows for partial refunds
- Handle void operations with proper audit trails

### Performance

- Cache carrier validation results to reduce API calls
- Batch invoice operations when processing multiple orders
- Implement retry logic for network failures

### Security

- Validate all input parameters before processing
- Sanitize carrier codes and VAT numbers
- Log invoice operations for audit purposes

## Testing

```typescript
import { InvoiceGateway, InvoiceCarriers, TaxType } from '@rytass/invoice';

describe('Invoice Management', () => {
  let invoiceGateway: InvoiceGateway;

  beforeEach(() => {
    // Initialize test gateway
    invoiceGateway = new TestInvoiceGateway();
  });

  it('should issue B2C invoice successfully', async () => {
    const invoice = await invoiceGateway.issue({
      items: [
        {
          name: 'Test Product',
          unitPrice: 1000,
          quantity: 1,
          taxType: TaxType.TAXED,
        },
      ],
      carrier: InvoiceCarriers.PRINT,
    });

    expect(invoice.number).toBeDefined();
    expect(invoice.amount).toBe(1050); // Including 5% tax
    expect(invoice.state).toBe(InvoiceState.ISSUED);
  });

  it('should validate mobile barcode', async () => {
    const isValid = await invoiceGateway.isMobileBarcodeValid('/ABC1234');
    expect(isValid).toBe(true);
  });
});
```

## License

MIT
