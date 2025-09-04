# Rytass Utils - Invoice Adapter Amego

A comprehensive TypeScript adapter for Amego's E-Invoice API, providing seamless integration with Taiwan's electronic invoice system. This adapter offers complete invoice lifecycle management with robust carrier support, tax compliance, and error handling.

## Features

- [x] Complete Amego E-Invoice API integration
- [x] B2B and B2C invoice issuance
- [x] Invoice voiding and cancellation
- [x] Invoice allowance (partial refund) management
- [x] Allowance invalidation support
- [x] Invoice query functionality (by order ID or invoice number)
- [x] Mobile barcode validation and verification
- [x] Love code validation with strict format checking
- [x] Full carrier type support (Mobile, MOICA, Platform, Love Code)
- [x] Tax calculation and validation
- [x] QR code and barcode generation
- [x] Email notification support
- [x] Production and development environment support
- [x] TypeScript type safety throughout
- [x] Comprehensive error handling and validation
- [x] 100% test coverage with edge case handling

## Installation

```bash
npm install @rytass/invoice-adapter-amego
# or
yarn add @rytass/invoice-adapter-amego
```

**Peer Dependencies:**

```bash
npm install @rytass/invoice
```

## Configuration

### Environment Setup

```typescript
import { AmegoInvoiceGateway, AmegoBaseUrls } from '@rytass/invoice-adapter-amego';

// Development environment
const developmentGateway = new AmegoInvoiceGateway({
  appKey: 'YOUR_DEVELOPMENT_APP_KEY',
  vatNumber: '12345678', // Your company VAT number
  baseUrl: AmegoBaseUrls.DEVELOPMENT, // https://invoice-api.amego.tw
});

// Production environment
const productionGateway = new AmegoInvoiceGateway({
  appKey: 'YOUR_PRODUCTION_APP_KEY',
  vatNumber: '12345678', // Your company VAT number
  baseUrl: AmegoBaseUrls.PRODUCTION, // https://invoice-api.amego.tw
});
```

### Configuration Options

```typescript
interface AmegoInvoiceGatewayOptions {
  appKey: string; // Amego API application key
  vatNumber: string; // Seller's VAT number (統編)
  baseUrl?: AmegoBaseUrls; // API base URL (development/production)
}
```

## Basic Usage

### B2C Invoice Issuance

```typescript
import { AmegoInvoiceGateway, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-amego';

const gateway = new AmegoInvoiceGateway({
  appKey: process.env.AMEGO_APP_KEY!,
  vatNumber: process.env.SELLER_VAT_NUMBER!,
  baseUrl: AmegoBaseUrls.PRODUCTION,
});

// Issue B2C invoice with print carrier
const invoice = await gateway.issue({
  orderId: 'ORD-2024-001',
  buyerEmail: 'customer@example.com',
  buyerName: 'Customer Name',
  carrier: InvoiceCarriers.PRINT,
  taxType: TaxType.TAXED,
  detailVat: true, // Prices include tax
  items: [
    {
      name: 'Premium Product',
      quantity: 2,
      unitPrice: 1000, // Including tax
      unit: '個',
      taxType: TaxType.TAXED,
      remark: '高品質商品',
    },
    {
      name: 'Standard Service',
      quantity: 1,
      unitPrice: 500, // Including tax
      unit: '次',
      taxType: TaxType.TAXED,
    },
  ],
});

console.log('Invoice Number:', invoice.number);
console.log('Random Code:', invoice.randomCode);
console.log('Total Amount:', invoice.amount);
console.log('QR Code Left:', invoice.qrCodeLeft);
console.log('QR Code Right:', invoice.qrCodeRight);
```

### B2B Invoice Issuance

```typescript
// B2B invoice with company information
const b2bInvoice = await gateway.issue({
  orderId: 'B2B-2024-001',
  vatNumber: '12345678', // Buyer's VAT number
  buyerName: '採購公司股份有限公司',
  buyerEmail: 'procurement@buyer-company.com.tw',
  carrier: InvoiceCarriers.PRINT,
  taxType: TaxType.TAXED,
  detailVat: true,
  remark: 'B2B月結訂單',
  items: [
    {
      name: '企業軟體授權',
      quantity: 10,
      unitPrice: 5000,
      unit: '套',
      taxType: TaxType.TAXED,
      remark: '年度授權',
    },
    {
      name: '技術支援服務',
      quantity: 12,
      unitPrice: 8000,
      unit: '月',
      taxType: TaxType.TAXED,
      remark: '24/7支援',
    },
  ],
});
```

### B2C Invoice with Mobile Carrier

```typescript
// Validate mobile barcode first
const mobileBarcode = '/ABC12345';
const isValidBarcode = await gateway.isMobileBarcodeValid(mobileBarcode);

if (!isValidBarcode) {
  throw new Error('Invalid mobile barcode');
}

// Issue invoice with mobile carrier
const mobileInvoice = await gateway.issue({
  orderId: 'MOBILE-2024-001',
  buyerEmail: 'mobile-user@example.com',
  carrier: InvoiceCarriers.MOBILE(mobileBarcode),
  taxType: TaxType.TAXED,
  detailVat: true,
  items: [
    {
      name: 'Digital Product',
      quantity: 1,
      unitPrice: 2000,
      unit: '個',
      taxType: TaxType.TAXED,
    },
  ],
});
```

### Invoice with Love Code (Donation)

```typescript
// Issue invoice with donation to charity
const donationInvoice = await gateway.issue({
  orderId: 'DONATION-2024-001',
  buyerEmail: 'donor@example.com',
  carrier: InvoiceCarriers.LOVE_CODE('12345'), // 3-7 digits
  taxType: TaxType.TAXED,
  detailVat: true,
  items: [
    {
      name: 'Charitable Purchase',
      quantity: 3,
      unitPrice: 500,
      unit: '份',
      taxType: TaxType.TAXED,
    },
  ],
});
```

## Advanced Usage

### Mixed Tax Type Items

```typescript
const mixedTaxInvoice = await gateway.issue({
  orderId: 'MIXED-2024-001',
  buyerEmail: 'export@customer.com',
  carrier: InvoiceCarriers.PRINT,
  taxType: TaxType.MIXED, // Mixed tax types
  detailVat: true,
  customsMark: CustomsMark.YES,
  items: [
    {
      name: 'Domestic Product',
      quantity: 2,
      unitPrice: 1000,
      unit: '個',
      taxType: TaxType.TAXED, // 5% tax
      remark: '國內商品',
    },
    {
      name: 'Tax-Free Product',
      quantity: 1,
      unitPrice: 2000,
      unit: '件',
      taxType: TaxType.TAX_FREE, // No tax
      remark: '免稅商品',
    },
    {
      name: 'Export Product',
      quantity: 1,
      unitPrice: 3000,
      unit: '組',
      taxType: TaxType.ZERO_TAX, // Export (0% tax)
      remark: '出口商品',
    },
  ],
});
```

### Custom Tax Calculation

```typescript
// Manual tax calculation (detailVat: false)
const customTaxInvoice = await gateway.issue({
  orderId: 'CUSTOM-2024-001',
  buyerEmail: 'customer@example.com',
  carrier: InvoiceCarriers.PRINT,
  taxType: TaxType.TAXED,
  detailVat: false, // Prices exclude tax
  salesAmount: 10000, // Sales amount (excluding tax)
  taxAmount: 500, // Tax amount
  totalAmount: 10500, // Total amount (including tax)
  items: [
    {
      name: 'Custom Product',
      quantity: 1,
      unitPrice: 10000, // Excluding tax
      unit: '個',
      taxType: TaxType.TAXED,
    },
  ],
});
```

### Invoice Query Operations

```typescript
// Query by order ID
const queriedByOrder = await gateway.query({
  orderId: 'ORD-2024-001',
});

// Query by invoice number
const queriedByNumber = await gateway.query({
  invoiceNumber: 'AA12345678',
});

console.log('Invoice State:', queriedByOrder.state);
console.log('Tax Amount:', queriedByOrder.taxAmount);
console.log('Issue Date:', queriedByOrder.issuedOn);
```

### Invoice Voiding

```typescript
// Query and void an invoice
const invoiceToVoid = await gateway.query({
  orderId: 'ORD-2024-001',
});

const voidedInvoice = await gateway.void(invoiceToVoid, {
  reason: 'Customer requested cancellation due to product defect',
});

console.log('Void Status:', voidedInvoice.state); // InvoiceState.VOID
console.log('Voided On:', voidedInvoice.voidOn);
```

### Invoice Allowance (Partial Refund)

```typescript
// Create allowance for partial refund
const originalInvoice = await gateway.query({
  orderId: 'ORD-2024-001',
});

const allowanceInvoice = await gateway.allowance(
  originalInvoice,
  [
    {
      name: 'Returned Product',
      quantity: 1, // Return 1 item
      unitPrice: 1000,
      unit: '個',
      taxType: TaxType.TAXED,
      remark: '商品瑕疵退貨',
    },
  ],
  {
    allowanceType: AmegoAllowanceType.BUYER_ISSUED,
    issuedAmount: originalInvoice.amount,
  },
);

console.log('Allowance Number:', allowanceInvoice.allowances[0].number);
console.log('Allowance Amount:', allowanceInvoice.allowances[0].amount);
```

### Invalidate Allowance

```typescript
// Invalidate a previously issued allowance
const allowanceToInvalidate = allowanceInvoice.allowances[0];
const updatedInvoice = await gateway.invalidAllowance(allowanceToInvalidate);

console.log('Allowance invalidated:', updatedInvoice.allowances[0].invalidatedOn);
```

## Carrier Types

The adapter supports all Taiwan e-invoice carrier types with validation:

### Mobile Carrier (手機條碼)

```typescript
import { InvoiceCarriers } from '@rytass/invoice-adapter-amego';

// Mobile barcode carrier with validation
const mobileBarcode = '/ABC12345';
const isValid = await gateway.isMobileBarcodeValid(mobileBarcode);

if (isValid) {
  const carrier = InvoiceCarriers.MOBILE(mobileBarcode);
  // Use in invoice issuance
}
```

### MOICA Carrier (自然人憑證)

```typescript
// Natural person certificate carrier
const moicaCarrier = InvoiceCarriers.MOICA('ABC123DEF456GHI789');
```

### Platform Carrier (平台載具)

```typescript
// Platform-specific carrier
const platformCarrier = InvoiceCarriers.PLATFORM('platform-member-id');
```

### Love Code (愛心碼)

```typescript
// Charity donation carrier with validation
const loveCode = '12345'; // 3-7 digits, numbers only

// Love code format is automatically validated
const loveCodeCarrier = InvoiceCarriers.LOVE_CODE(loveCode);
```

### Print Carrier (紙本發票)

```typescript
// Traditional print receipt
const printCarrier = InvoiceCarriers.PRINT;
```

## Error Handling

### Amego Specific Errors

```typescript
try {
  const invoice = await gateway.issue({
    orderId: 'ERROR-TEST',
    buyerEmail: 'test@example.com',
    carrier: InvoiceCarriers.PRINT,
    taxType: TaxType.TAXED,
    detailVat: true,
    items: [
      /* invalid items */
    ],
  });
} catch (error) {
  if (error.message.includes('Order ID is required')) {
    console.error('Order ID validation failed');
  } else if (error.message.includes('Invalid VAT number format')) {
    console.error('VAT number format validation failed');
  } else if (error.message.includes('Amego invoice issue failed')) {
    console.error('Amego API error:', error.message);
  } else if (error.message.includes('Invoice is not issued')) {
    console.error('Cannot perform operation on non-issued invoice');
  } else {
    console.error('Invoice issuance failed:', error.message);
  }
}
```

### Validation Errors

```typescript
// Handle validation errors
async function safeInvoiceIssue(invoiceData: AmegoInvoiceIssueOptions) {
  try {
    return await gateway.issue(invoiceData);
  } catch (error) {
    if (error.message.includes('Love code must be 3-7 digits')) {
      console.error('Invalid love code format - must be 3-7 numeric digits');
    } else if (error.message.includes('Order ID exceeds maximum length')) {
      console.error(`Order ID too long - maximum ${AMEGO_CONSTANTS.MAX_ORDER_ID_LENGTH} characters`);
    } else if (error.message.includes('Item name exceeds maximum length')) {
      console.error(`Item name too long - maximum ${AMEGO_CONSTANTS.MAX_ITEM_NAME_LENGTH} characters`);
    } else {
      console.error('Validation error:', error.message);
    }
    throw error;
  }
}
```

## Constants

The adapter exports useful constants to avoid magic numbers:

```typescript
import { AMEGO_CONSTANTS } from '@rytass/invoice-adapter-amego';

console.log(AMEGO_CONSTANTS.MAX_ORDER_ID_LENGTH); // 40
console.log(AMEGO_CONSTANTS.MAX_ITEM_NAME_LENGTH); // 256
console.log(AMEGO_CONSTANTS.MAX_ITEM_UNIT_LENGTH); // 6
console.log(AMEGO_CONSTANTS.MAX_ITEM_REMARK_LENGTH); // 40
console.log(AMEGO_CONSTANTS.DEFAULT_TAX_RATE); // 0.05
console.log(AMEGO_CONSTANTS.LOVE_CODE_MIN_LENGTH); // 3
console.log(AMEGO_CONSTANTS.LOVE_CODE_MAX_LENGTH); // 7

// Use constants in validation
function validateOrderId(orderId: string): boolean {
  return orderId.length <= AMEGO_CONSTANTS.MAX_ORDER_ID_LENGTH;
}

function validateItemName(name: string): boolean {
  return name.length <= AMEGO_CONSTANTS.MAX_ITEM_NAME_LENGTH;
}
```

## Integration Examples

### Express.js API Integration

```typescript
import express from 'express';
import { AmegoInvoiceGateway, AmegoBaseUrls, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-amego';

const app = express();
const gateway = new AmegoInvoiceGateway({
  appKey: process.env.AMEGO_APP_KEY!,
  vatNumber: process.env.SELLER_VAT_NUMBER!,
  baseUrl: process.env.NODE_ENV === 'production' ? AmegoBaseUrls.PRODUCTION : AmegoBaseUrls.DEVELOPMENT,
});

// Issue invoice endpoint
app.post('/api/invoices', async (req, res) => {
  try {
    const { orderId, customer, items, carrierType, carrierCode } = req.body;

    // Validate mobile barcode if provided
    if (carrierType === 'mobile' && carrierCode) {
      const isValid = await gateway.isMobileBarcodeValid(carrierCode);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid mobile barcode' });
      }
    }

    // Determine carrier
    let carrier = InvoiceCarriers.PRINT;
    switch (carrierType) {
      case 'mobile':
        carrier = InvoiceCarriers.MOBILE(carrierCode);
        break;
      case 'love_code':
        carrier = InvoiceCarriers.LOVE_CODE(carrierCode);
        break;
      case 'moica':
        carrier = InvoiceCarriers.MOICA(carrierCode);
        break;
      case 'platform':
        carrier = InvoiceCarriers.PLATFORM(carrierCode);
        break;
    }

    // Issue invoice
    const invoice = await gateway.issue({
      orderId,
      buyerEmail: customer.email,
      buyerName: customer.name,
      carrier,
      taxType: TaxType.TAXED,
      detailVat: true,
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        unit: item.unit || '個',
        taxType: TaxType.TAXED,
        remark: item.notes,
      })),
    });

    res.json({
      success: true,
      invoice: {
        number: invoice.number,
        randomCode: invoice.randomCode,
        amount: invoice.amount,
        taxAmount: invoice.taxAmount,
        qrCodeLeft: invoice.qrCodeLeft,
        qrCodeRight: invoice.qrCodeRight,
        issuedOn: invoice.issuedOn,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Query invoice endpoint
app.get('/api/invoices/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { type } = req.query; // 'order' or 'invoice'

    let invoice;
    if (type === 'invoice') {
      invoice = await gateway.query({ invoiceNumber: identifier });
    } else {
      invoice = await gateway.query({ orderId: identifier });
    }

    res.json({
      success: true,
      invoice: {
        number: invoice.number,
        orderId: invoice.orderId,
        state: invoice.state,
        amount: invoice.amount,
        issuedOn: invoice.issuedOn,
      },
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Invoice not found',
    });
  }
});

// Void invoice endpoint
app.post('/api/invoices/:orderId/void', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const invoice = await gateway.query({ orderId });
    const voidedInvoice = await gateway.void(invoice, { reason });

    res.json({
      success: true,
      invoice: {
        number: voidedInvoice.number,
        state: voidedInvoice.state,
        voidedOn: voidedInvoice.voidOn,
      },
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
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { AmegoInvoiceGateway, AmegoBaseUrls, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-amego';

@Injectable()
export class AmegoInvoiceService {
  private readonly gateway: AmegoInvoiceGateway;

  constructor() {
    this.gateway = new AmegoInvoiceGateway({
      appKey: process.env.AMEGO_APP_KEY!,
      vatNumber: process.env.SELLER_VAT_NUMBER!,
      baseUrl: process.env.NODE_ENV === 'production' ? AmegoBaseUrls.PRODUCTION : AmegoBaseUrls.DEVELOPMENT,
    });
  }

  async createInvoiceForOrder(order: {
    id: string;
    customer: {
      email?: string;
      name?: string;
      vatNumber?: string;
      mobileBarcode?: string;
    };
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      unit?: string;
      notes?: string;
    }>;
    notes?: string;
  }) {
    // Validate mobile barcode if provided
    if (order.customer.mobileBarcode) {
      const isValid = await this.gateway.isMobileBarcodeValid(order.customer.mobileBarcode);
      if (!isValid) {
        throw new BadRequestException('Invalid mobile barcode');
      }
    }

    // Determine invoice type and carrier
    const isB2B = !!order.customer.vatNumber;
    let carrier = InvoiceCarriers.PRINT;

    if (!isB2B && order.customer.mobileBarcode) {
      carrier = InvoiceCarriers.MOBILE(order.customer.mobileBarcode);
    }

    // Issue invoice
    const invoice = await this.gateway.issue({
      orderId: order.id,
      buyerEmail: order.customer.email,
      buyerName: order.customer.name,
      vatNumber: order.customer.vatNumber,
      carrier,
      taxType: TaxType.TAXED,
      detailVat: true,
      remark: order.notes,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        unit: item.unit || '個',
        taxType: TaxType.TAXED,
        remark: item.notes,
      })),
    });

    return {
      invoiceNumber: invoice.number,
      randomCode: invoice.randomCode,
      amount: invoice.amount,
      taxAmount: invoice.taxAmount,
      issuedOn: invoice.issuedOn,
      qrCodeLeft: invoice.qrCodeLeft,
      qrCodeRight: invoice.qrCodeRight,
    };
  }

  async queryInvoice(identifier: string, type: 'order' | 'invoice' = 'order') {
    try {
      let invoice;
      if (type === 'invoice') {
        invoice = await this.gateway.query({ invoiceNumber: identifier });
      } else {
        invoice = await this.gateway.query({ orderId: identifier });
      }

      return {
        invoiceNumber: invoice.number,
        orderId: invoice.orderId,
        randomCode: invoice.randomCode,
        state: invoice.state,
        amount: invoice.amount,
        taxAmount: invoice.taxAmount,
        issuedOn: invoice.issuedOn,
        voidOn: invoice.voidOn,
      };
    } catch (error) {
      throw new NotFoundException('Invoice not found');
    }
  }

  async voidInvoice(orderId: string, reason: string) {
    const invoice = await this.gateway.query({ orderId });

    if (invoice.state === InvoiceState.VOID) {
      throw new BadRequestException('Invoice is already voided');
    }

    const voidedInvoice = await this.gateway.void(invoice, { reason });

    return {
      invoiceNumber: voidedInvoice.number,
      state: voidedInvoice.state,
      voidedOn: voidedInvoice.voidOn,
    };
  }

  async createAllowance(
    orderId: string,
    allowanceItems: Array<{
      name: string;
      price: number;
      quantity: number;
      unit?: string;
      notes?: string;
    }>,
  ) {
    const originalInvoice = await this.gateway.query({ orderId });

    const allowanceInvoice = await this.gateway.allowance(
      originalInvoice,
      allowanceItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        unit: item.unit || '個',
        taxType: TaxType.TAXED,
        remark: item.notes,
      })),
    );

    return {
      allowanceNumber: allowanceInvoice.allowances[0].number,
      allowanceAmount: allowanceInvoice.allowances[0].amount,
      allowancedOn: allowanceInvoice.allowances[0].issuedOn,
    };
  }
}
```

### E-commerce Platform Integration

```typescript
import { AmegoInvoiceGateway, InvoiceCarriers, TaxType, CustomsMark } from '@rytass/invoice-adapter-amego';

class EcommerceAmegoInvoiceProcessor {
  constructor(private gateway: AmegoInvoiceGateway) {}

  async processOrderInvoice(order: {
    id: string;
    customer: {
      email?: string;
      name?: string;
      vatNumber?: string;
      preferences: {
        carrier?: 'print' | 'mobile' | 'love_code' | 'moica' | 'platform';
        carrierCode?: string;
      };
    };
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      unit?: string;
      category: string;
      notes?: string;
      isExport?: boolean;
    }>;
    shipping: {
      isExport?: boolean;
      notes?: string;
    };
  }) {
    // Determine carrier based on customer preferences
    let carrier = InvoiceCarriers.PRINT;

    if (order.customer.preferences.carrier && order.customer.preferences.carrierCode) {
      switch (order.customer.preferences.carrier) {
        case 'mobile':
          const isValidBarcode = await this.gateway.isMobileBarcodeValid(order.customer.preferences.carrierCode);
          if (isValidBarcode) {
            carrier = InvoiceCarriers.MOBILE(order.customer.preferences.carrierCode);
          }
          break;
        case 'love_code':
          carrier = InvoiceCarriers.LOVE_CODE(order.customer.preferences.carrierCode);
          break;
        case 'moica':
          carrier = InvoiceCarriers.MOICA(order.customer.preferences.carrierCode);
          break;
        case 'platform':
          carrier = InvoiceCarriers.PLATFORM(order.customer.preferences.carrierCode);
          break;
      }
    }

    // Determine tax type based on items
    const hasExportItems = order.items.some(item => item.isExport);
    const hasDomesticItems = order.items.some(item => !item.isExport);
    const taxType =
      hasExportItems && hasDomesticItems ? TaxType.MIXED : hasExportItems ? TaxType.ZERO_TAX : TaxType.TAXED;

    // Map items with appropriate tax types
    const invoiceItems = order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      unit: item.unit || '個',
      taxType: item.isExport ? TaxType.ZERO_TAX : TaxType.TAXED,
      remark: item.notes,
    }));

    const invoice = await this.gateway.issue({
      orderId: order.id,
      buyerEmail: order.customer.email,
      buyerName: order.customer.name,
      vatNumber: order.customer.vatNumber,
      carrier,
      taxType,
      detailVat: true,
      customsMark: order.shipping.isExport ? CustomsMark.YES : CustomsMark.NO,
      remark: order.shipping.notes,
      items: invoiceItems,
    });

    return {
      invoiceNumber: invoice.number,
      randomCode: invoice.randomCode,
      amount: invoice.amount,
      taxAmount: invoice.taxAmount,
      qrCodeLeft: invoice.qrCodeLeft,
      qrCodeRight: invoice.qrCodeRight,
    };
  }
}
```

## Best Practices

### Configuration Management

- Store sensitive credentials in environment variables
- Use different configurations for development and production environments
- Regularly rotate API keys and credentials
- Implement proper error handling for authentication failures

### Invoice Processing

- Always validate mobile barcodes before invoice issuance
- Implement proper error handling for all Amego API calls
- Store order IDs and invoice mappings for future reference
- Handle duplicate order IDs appropriately

### Tax Compliance

- Use correct tax types for different product categories
- Handle export/import scenarios with appropriate customs marks
- Validate VAT numbers for B2B transactions
- Keep audit trails of all invoice operations

### Performance Optimization

- Implement caching for carrier validation results
- Use appropriate timeout settings for API calls
- Batch process invoices when handling high volumes
- Monitor API response times and implement alerting

### Security

- Validate all input parameters before processing
- Sanitize customer data and item information
- Log all invoice operations for audit purposes
- Implement proper access controls for invoice management

## Testing

```typescript
import { AmegoInvoiceGateway, AmegoBaseUrls, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-amego';

describe('Amego Invoice Integration', () => {
  let gateway: AmegoInvoiceGateway;

  beforeEach(() => {
    gateway = new AmegoInvoiceGateway({
      appKey: 'test_app_key',
      vatNumber: '12345678',
      baseUrl: AmegoBaseUrls.DEVELOPMENT,
    });
  });

  it('should issue B2C invoice successfully', async () => {
    const invoice = await gateway.issue({
      orderId: 'TEST-001',
      buyerEmail: 'test@customer.com',
      carrier: InvoiceCarriers.PRINT,
      taxType: TaxType.TAXED,
      detailVat: true,
      items: [
        {
          name: 'Test Product',
          quantity: 1,
          unitPrice: 1000,
          unit: '個',
          taxType: TaxType.TAXED,
        },
      ],
    });

    expect(invoice.number).toBeDefined();
    expect(invoice.amount).toBe(1000);
    expect(invoice.state).toBe(InvoiceState.ISSUED);
  });

  it('should validate mobile barcode', async () => {
    const isValid = await gateway.isMobileBarcodeValid('/ABC123');
    expect(typeof isValid).toBe('boolean');
  });

  it('should query invoice by order ID', async () => {
    const queriedInvoice = await gateway.query({
      orderId: 'TEST-001',
    });

    expect(queriedInvoice.orderId).toBe('TEST-001');
  });

  it('should create allowance successfully', async () => {
    const originalInvoice = await gateway.query({
      orderId: 'TEST-001',
    });

    const allowanceInvoice = await gateway.allowance(originalInvoice, [
      {
        name: 'Returned Product',
        quantity: 1,
        unitPrice: 1000,
        unit: '個',
        taxType: TaxType.TAXED,
      },
    ]);

    expect(allowanceInvoice.allowances).toHaveLength(1);
    expect(allowanceInvoice.allowances[0].amount).toBe(1000);
  });
});
```

## API Reference

### AmegoInvoiceGateway

#### Constructor Options

```typescript
interface AmegoInvoiceGatewayOptions {
  appKey: string; // Your Amego API application key
  vatNumber: string; // Your company's VAT number (統編)
  baseUrl?: AmegoBaseUrls; // API endpoint (DEVELOPMENT or PRODUCTION)
}
```

#### Methods

##### `issue(options: AmegoInvoiceIssueOptions): Promise<AmegoInvoice>`

Issues a new invoice with the specified options.

**Parameters:**

- `orderId: string` - Unique order identifier
- `items: AmegoPaymentItem[]` - Invoice line items
- `taxType: TaxType` - Overall tax type for the invoice
- `detailVat: boolean` - Whether prices include tax
- `buyerEmail?: string` - Buyer's email address
- `buyerName?: string` - Buyer's name
- `vatNumber?: string` - Buyer's VAT number (for B2B)
- `carrier?: InvoiceCarrier` - Delivery carrier information
- `remark?: string` - Additional notes

##### `query(options: AmegoInvoiceQueryArgs): Promise<AmegoInvoice>`

Queries an invoice by order ID or invoice number.

**Parameters:**

- `orderId?: string` - Order identifier
- `invoiceNumber?: string` - Invoice number

##### `allowance(invoice: AmegoInvoice, items: AmegoPaymentItem[], options?: AmegoAllowanceOptions): Promise<AmegoInvoice>`

Creates an allowance (partial refund) for an existing invoice.

**Parameters:**

- `invoice: AmegoInvoice` - Original invoice
- `items: AmegoPaymentItem[]` - Items to be refunded
- `options?: AmegoAllowanceOptions` - Additional allowance options

##### `invalidAllowance(allowance: AmegoAllowance): Promise<AmegoInvoice>`

Cancels an existing allowance.

**Parameters:**

- `allowance: AmegoAllowance` - Allowance to be invalidated

##### `void(invoice: AmegoInvoice, options: AmegoInvoiceVoidOptions): Promise<AmegoInvoice>`

Voids an issued invoice.

**Parameters:**

- `invoice: AmegoInvoice` - Invoice to be voided
- `options.reason: string` - Reason for voiding

##### `isMobileBarcodeValid(code: string): Promise<boolean>`

Validates a mobile carrier barcode format and existence.

**Parameters:**

- `code: string` - Mobile barcode to validate

**Returns:**

- `Promise<boolean>` - Whether the barcode is valid

### Type Definitions

#### AmegoPaymentItem

```typescript
interface AmegoPaymentItem {
  name: string; // Item name (max 256 characters)
  quantity: number; // Quantity
  unitPrice: number; // Unit price
  unit?: string; // Unit of measurement (max 6 characters)
  taxType: TaxType; // Tax type for this item
  remark?: string; // Additional notes (max 40 characters)
}
```

#### AmegoInvoiceIssueOptions

```typescript
interface AmegoInvoiceIssueOptions {
  orderId: string; // Order ID (max 40 characters)
  items: AmegoPaymentItem[]; // Invoice items
  taxType: TaxType; // Overall tax type
  detailVat: boolean; // Whether prices include tax
  buyerEmail?: string; // Buyer's email
  buyerName?: string; // Buyer's name
  vatNumber?: string; // Buyer's VAT number
  carrier?: InvoiceCarrier; // Delivery carrier
  remark?: string; // Additional notes
  salesAmount?: number; // Manual sales amount
  taxAmount?: number; // Manual tax amount
  totalAmount?: number; // Manual total amount
}
```

## Development

### Using this package in your project

```bash
# Install dependencies
npm install @rytass/invoice-adapter-amego @rytass/invoice

# Run tests
npm test

# Build your project
npm run build
```

### Contributing to this package (Utils monorepo)

```bash
# Install dependencies for the entire monorepo
npm install

# Run tests specifically for this package
npm run test packages/invoice-adapter-amego

# Build the entire monorepo
npm run build

# Lint the codebase
npm run lint
```

## License

MIT
