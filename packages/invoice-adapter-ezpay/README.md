# Rytass Utils - Invoice Adapter EZPay

A comprehensive EZPay electronic invoice integration adapter for Taiwan's electronic invoice system. This adapter provides seamless integration with EZPay's invoice services, supporting both B2B and B2C scenarios with complete carrier management and tax compliance features.

## Features

- [x] Complete EZPay invoice API integration
- [x] B2B and B2C invoice issuance
- [x] Multiple carrier type support (Mobile, Love Code, MOICA, Print)
- [x] Mobile barcode and Love Code validation
- [x] Invoice query functionality
- [x] Invoice voiding operations
- [x] Invoice allowance (partial refund) management
- [x] Real-time invoice status tracking
- [x] QR code and barcode generation
- [x] Tax calculation and validation
- [x] Custom order ID mapping
- [x] Email notification support
- [x] Production and development environment support
- [x] TypeScript type safety
- [x] Comprehensive error handling

## Installation

```bash
npm install @rytass/invoice-adapter-ezpay
# or
yarn add @rytass/invoice-adapter-ezpay
```

**Peer Dependencies:**
```bash
npm install @rytass/invoice
```

## Configuration

### Environment Setup

```typescript
import { EZPayInvoiceGateway, EZPayBaseUrls } from '@rytass/invoice-adapter-ezpay';

// Development environment
const developmentGateway = new EZPayInvoiceGateway({
  hashKey: 'YOUR_DEVELOPMENT_AES_KEY',
  hashIv: 'YOUR_DEVELOPMENT_AES_IV',
  merchantId: 'YOUR_DEVELOPMENT_MERCHANT_ID',
  baseUrl: EZPayBaseUrls.DEVELOPMENT // https://cinv.ezpay.com.tw
});

// Production environment
const productionGateway = new EZPayInvoiceGateway({
  hashKey: 'YOUR_PRODUCTION_AES_KEY',
  hashIv: 'YOUR_PRODUCTION_AES_IV',
  merchantId: 'YOUR_PRODUCTION_MERCHANT_ID',
  baseUrl: EZPayBaseUrls.PRODUCTION // https://inv.ezpay.com.tw
});
```

### Configuration Options

```typescript
interface EZPayInvoiceGatewayOptions {
  hashKey?: string;      // EZPay AES encryption key
  hashIv?: string;       // EZPay AES initialization vector
  merchantId?: string;   // EZPay merchant identifier
  baseUrl?: EZPayBaseUrls; // API base URL (development/production)
}
```

## Basic Usage

### B2C Invoice Issuance

```typescript
import { EZPayInvoiceGateway, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-ezpay';

const gateway = new EZPayInvoiceGateway({
  hashKey: process.env.EZPAY_HASH_KEY,
  hashIv: process.env.EZPAY_HASH_IV,
  merchantId: process.env.EZPAY_MERCHANT_ID,
  baseUrl: EZPayBaseUrls.PRODUCTION
});

// Issue B2C invoice with print carrier
const invoice = await gateway.issue({
  orderId: 'ORD-2024-001',
  buyerName: 'Customer Name',
  buyerEmail: 'customer@example.com',
  carrier: InvoiceCarriers.PRINT,
  items: [
    {
      name: 'Product A',
      unitPrice: 1000,
      quantity: 2,
      unit: '個',
      taxType: TaxType.TAXED
    },
    {
      name: 'Product B',
      unitPrice: 500,
      quantity: 1,
      unit: '件',
      taxType: TaxType.TAXED
    }
  ]
});

console.log('Invoice Number:', invoice.number);
console.log('Random Code:', invoice.randomCode);
console.log('Total Amount:', invoice.amount);
```

### B2C Invoice with Mobile Barcode

```typescript
// Validate mobile barcode first
const mobileBarcode = '/ABC12345';
const isValidBarcode = await gateway.isMobileBarcodeValid(mobileBarcode);

if (!isValidBarcode) {
  throw new Error('Invalid mobile barcode');
}

// Issue invoice with mobile carrier
const mobileInvoice = await gateway.issue({
  orderId: 'ORD-2024-002',
  buyerName: 'Mobile User',
  carrier: InvoiceCarriers.MOBILE(mobileBarcode),
  items: [
    {
      name: 'Digital Service',
      unitPrice: 2000,
      quantity: 1,
      taxType: TaxType.TAXED
    }
  ]
});
```

### B2C Invoice with Love Code (Donation)

```typescript
// Validate love code
const loveCode = '001';
const isValidLoveCode = await gateway.isLoveCodeValid(loveCode);

if (!isValidLoveCode) {
  throw new Error('Invalid love code');
}

// Issue invoice with love code carrier
const donationInvoice = await gateway.issue({
  orderId: 'ORD-2024-003',
  buyerName: 'Donor',
  buyerEmail: 'donor@example.com',
  carrier: InvoiceCarriers.LOVE_CODE(loveCode),
  items: [
    {
      name: 'Charitable Purchase',
      unitPrice: 1500,
      quantity: 1,
      taxType: TaxType.TAXED
    }
  ]
});
```

### B2B Invoice Issuance

```typescript
// B2B invoices require VAT number and always use print carrier
const b2bInvoice = await gateway.issue({
  orderId: 'B2B-2024-001',
  buyerName: '八拍子股份有限公司',
  buyerAddress: '台北市中山區中山北路二段72巷21號',
  buyerEmail: 'accounting@company.com.tw',
  vatNumber: '54366906',
  carrier: InvoiceCarriers.PRINT,
  items: [
    {
      name: '專業服務',
      unitPrice: 50000,
      quantity: 1,
      unit: '式',
      taxType: TaxType.TAXED
    },
    {
      name: '系統維護',
      unitPrice: 20000,
      quantity: 1,
      unit: '月',
      taxType: TaxType.TAXED
    }
  ]
});
```

## Advanced Usage

### Mixed Tax Type Items

```typescript
const mixedTaxInvoice = await gateway.issue({
  orderId: 'MIX-2024-001',
  buyerName: 'Export Customer',
  buyerEmail: 'export@customer.com',
  carrier: InvoiceCarriers.PRINT,
  customsMark: CustomsMark.YES, // For export items
  items: [
    {
      name: 'Domestic Product',
      unitPrice: 1000,
      quantity: 2,
      taxType: TaxType.TAXED // 5% tax
    },
    {
      name: 'Tax-Free Product',
      unitPrice: 2000,
      quantity: 1,
      taxType: TaxType.TAX_FREE // No tax
    },
    {
      name: 'Export Product',
      unitPrice: 3000,
      quantity: 1,
      taxType: TaxType.ZERO_TAX // Export (0% tax)
    }
  ]
});
```

### Invoice with Custom Parameters

```typescript
const customInvoice = await gateway.issue({
  orderId: 'CUSTOM-2024-001',
  buyerName: 'Premium Customer',
  buyerEmail: 'premium@customer.com',
  carrier: InvoiceCarriers.PRINT,
  ezPayTransNumber: 'TRANS-001', // Custom transaction number
  remark: 'Special order processing', // Additional remarks
  specialTaxPercentage: 18, // Custom tax percentage for special items
  items: [
    {
      name: 'Premium Service',
      unitPrice: 10000,
      quantity: 1,
      unit: '次',
      taxType: TaxType.SPECIAL // Special tax calculation
    }
  ]
});
```

### Invoice Query Operations

```typescript
// Query by invoice number and random code
const queriedInvoice1 = await gateway.query({
  invoiceNumber: 'ZZ12345678',
  randomCode: '1234'
});

// Query by order ID and amount
const queriedInvoice2 = await gateway.query({
  orderId: 'ORD-2024-001',
  amount: 2500
});

console.log('Invoice State:', queriedInvoice1.state);
console.log('Tax Amount:', queriedInvoice1.taxAmount);
console.log('Upload Status:', queriedInvoice1.uploadStatus);
```

### Invoice Voiding

```typescript
// Void an invoice
const voidedInvoice = await gateway.void(invoice, {
  reason: 'Customer requested cancellation due to order error'
});

console.log('Void Status:', voidedInvoice.state); // InvoiceState.VOID
console.log('Voided On:', voidedInvoice.voidOn);
```

### Invoice Allowance (Partial Refund)

```typescript
// Create allowance for partial refund
const allowanceInvoice = await gateway.allowance(
  originalInvoice,
  [
    {
      name: 'Returned Product',
      unitPrice: 1000,
      quantity: 1, // Return 1 item
      taxType: TaxType.TAXED
    }
  ],
  {
    taxType: TaxType.TAXED,
    buyerEmail: 'customer@example.com'
  }
);

console.log('Allowance Number:', allowanceInvoice.allowances[0].number);
console.log('Allowance Amount:', allowanceInvoice.allowances[0].amount);
console.log('Remaining Amount:', allowanceInvoice.allowances[0].remainingAmount);
```

### Invalidate Allowance

```typescript
// Invalidate a previously issued allowance
const updatedInvoice = await gateway.invalidAllowance(allowance);
console.log('Allowance invalidated at:', updatedInvoice.allowances[0].invalidatedOn);
```

## Carrier Management

### Available Carrier Types

```typescript
import { InvoiceCarriers, InvoiceCarrierType } from '@rytass/invoice-adapter-ezpay';

// Print carrier (traditional receipt)
const printCarrier = InvoiceCarriers.PRINT;

// Mobile barcode carrier
const mobileCarrier = InvoiceCarriers.MOBILE('/ABC12345');

// MOICA carrier (digital certificate)
const moicaCarrier = InvoiceCarriers.MOICA('CERT123456789ABC');

// Love code carrier (charity donation)
const loveCodeCarrier = InvoiceCarriers.LOVE_CODE('001');

// Platform carrier (e-commerce specific)
const platformCarrier = { 
  type: InvoiceCarrierType.PLATFORM, 
  code: 'PLATFORM001' 
};
```

### Carrier Validation

```typescript
// Validate mobile barcode
async function validateMobileCarrier(barcode: string): Promise<boolean> {
  try {
    return await gateway.isMobileBarcodeValid(barcode);
  } catch (error) {
    console.error('Mobile barcode validation failed:', error.message);
    return false;
  }
}

// Validate love code
async function validateLoveCode(code: string): Promise<boolean> {
  try {
    return await gateway.isLoveCodeValid(code);
  } catch (error) {
    console.error('Love code validation failed:', error.message);
    return false;
  }
}

// Usage in invoice processing
const barcode = '/XYZ789';
if (await validateMobileCarrier(barcode)) {
  const invoice = await gateway.issue({
    orderId: 'ORD-VALIDATED',
    buyerName: 'Validated Customer',
    carrier: InvoiceCarriers.MOBILE(barcode),
    items: [/* items */]
  });
}
```

## Error Handling

### EZPay Error Codes

```typescript
import { ErrorCode } from '@rytass/invoice-adapter-ezpay';

try {
  const invoice = await gateway.issue({
    orderId: 'ERROR-TEST',
    buyerName: 'Test Customer',
    carrier: InvoiceCarriers.PRINT,
    items: [/* invalid items */]
  });
} catch (error) {
  if (error.code === ErrorCode.INV10003) {
    console.error('Product information format error or missing data');
  } else if (error.code === ErrorCode.INV10004) {
    console.error('Product information subtotal calculation error');
  } else if (error.code === ErrorCode.INV10012) {
    console.error('Invoice amount and tax type validation error');
  } else if (error.code === ErrorCode.LIB10003) {
    console.error('Merchant custom number duplicated');
  } else {
    console.error('Invoice issuance failed:', error.message);
  }
}
```

### Common Error Scenarios

```typescript
// Handle network and configuration errors
async function safeInvoiceIssue(invoiceData: EZPayInvoiceIssueOptions) {
  try {
    return await gateway.issue(invoiceData);
  } catch (error) {
    switch (error.code) {
      case ErrorCode.KEY10002:
        console.error('Data decryption error - check hash key/IV');
        break;
      case ErrorCode.KEY10006:
        console.error('Store has not applied for electronic invoice activation');
        break;
      case ErrorCode.INV90005:
        console.error('Contract not signed or expired');
        break;
      case ErrorCode.INV90006:
        console.error('Available invoice count exhausted');
        break;
      case ErrorCode.NOR10001:
        console.error('Network connection error');
        break;
      default:
        console.error('Unexpected error:', error.message);
    }
    throw error;
  }
}
```

## Integration Examples

### Express.js API Integration

```typescript
import express from 'express';
import { EZPayInvoiceGateway, EZPayBaseUrls, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-ezpay';

const app = express();
const gateway = new EZPayInvoiceGateway({
  hashKey: process.env.EZPAY_HASH_KEY!,
  hashIv: process.env.EZPAY_HASH_IV!,
  merchantId: process.env.EZPAY_MERCHANT_ID!,
  baseUrl: process.env.NODE_ENV === 'production' 
    ? EZPayBaseUrls.PRODUCTION 
    : EZPayBaseUrls.DEVELOPMENT
});

// Issue invoice endpoint
app.post('/api/invoices', async (req, res) => {
  try {
    const { orderId, customer, items, carrierType, carrierCode } = req.body;

    // Validate carrier if needed
    if (carrierType === 'mobile' && carrierCode) {
      const isValid = await gateway.isMobileBarcodeValid(carrierCode);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid mobile barcode' });
      }
    }

    // Determine carrier
    let carrier;
    switch (carrierType) {
      case 'mobile':
        carrier = InvoiceCarriers.MOBILE(carrierCode);
        break;
      case 'love_code':
        carrier = InvoiceCarriers.LOVE_CODE(carrierCode);
        break;
      default:
        carrier = InvoiceCarriers.PRINT;
    }

    // Issue invoice
    const invoice = await gateway.issue({
      orderId,
      buyerName: customer.name,
      buyerEmail: customer.email,
      carrier,
      items: items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        taxType: TaxType.TAXED
      }))
    });

    res.json({
      success: true,
      invoice: {
        number: invoice.number,
        randomCode: invoice.randomCode,
        amount: invoice.amount,
        taxAmount: invoice.taxAmount,
        qrCodeLeft: invoice.qrCodeLeft,
        qrCodeRight: invoice.qrCodeRight
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// Query invoice endpoint
app.get('/api/invoices/:invoiceNumber', async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    const { randomCode } = req.query;

    const invoice = await gateway.query({
      invoiceNumber,
      randomCode: randomCode as string
    });

    res.json({
      success: true,
      invoice: {
        number: invoice.number,
        state: invoice.state,
        amount: invoice.amount,
        issuedOn: invoice.issuedOn,
        uploadStatus: invoice.uploadStatus
      }
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});
```

### NestJS Service Integration

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { EZPayInvoiceGateway, EZPayBaseUrls, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-ezpay';

@Injectable()
export class EZPayInvoiceService {
  private readonly gateway: EZPayInvoiceGateway;

  constructor() {
    this.gateway = new EZPayInvoiceGateway({
      hashKey: process.env.EZPAY_HASH_KEY!,
      hashIv: process.env.EZPAY_HASH_IV!,
      merchantId: process.env.EZPAY_MERCHANT_ID!,
      baseUrl: process.env.NODE_ENV === 'production' 
        ? EZPayBaseUrls.PRODUCTION 
        : EZPayBaseUrls.DEVELOPMENT
    });
  }

  async issueInvoiceForOrder(order: {
    id: string;
    customer: {
      name: string;
      email?: string;
      vatNumber?: string;
      address?: string;
      mobileBarcode?: string;
    };
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      unit?: string;
    }>;
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
    let carrier;

    if (isB2B) {
      carrier = InvoiceCarriers.PRINT;
    } else if (order.customer.mobileBarcode) {
      carrier = InvoiceCarriers.MOBILE(order.customer.mobileBarcode);
    } else {
      carrier = InvoiceCarriers.PRINT;
    }

    // Prepare invoice data
    const invoiceData = {
      orderId: order.id,
      buyerName: order.customer.name,
      buyerEmail: order.customer.email,
      carrier,
      items: order.items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        unit: item.unit || '個',
        taxType: TaxType.TAXED
      }))
    };

    // Add B2B specific fields
    if (isB2B) {
      Object.assign(invoiceData, {
        vatNumber: order.customer.vatNumber,
        buyerAddress: order.customer.address
      });
    }

    const invoice = await this.gateway.issue(invoiceData as any);

    return {
      invoiceNumber: invoice.number,
      randomCode: invoice.randomCode,
      amount: invoice.amount,
      taxAmount: invoice.taxAmount,
      issuedOn: invoice.issuedOn,
      qrCodeLeft: invoice.qrCodeLeft,
      qrCodeRight: invoice.qrCodeRight
    };
  }

  async processRefund(invoiceNumber: string, randomCode: string, refundItems: Array<{
    name: string;
    price: number;
    quantity: number;
  }>) {
    // Query original invoice
    const originalInvoice = await this.gateway.query({
      invoiceNumber,
      randomCode
    });

    // Create allowance
    const allowanceInvoice = await this.gateway.allowance(
      originalInvoice,
      refundItems.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        taxType: TaxType.TAXED
      }))
    );

    return {
      allowanceNumber: allowanceInvoice.allowances[0].number,
      allowanceAmount: allowanceInvoice.allowances[0].amount,
      remainingAmount: allowanceInvoice.allowances[0].remainingAmount
    };
  }

  async voidInvoice(invoiceNumber: string, randomCode: string, reason: string) {
    const invoice = await this.gateway.query({
      invoiceNumber,
      randomCode
    });

    const voidedInvoice = await this.gateway.void(invoice, { reason });
    
    return {
      invoiceNumber: voidedInvoice.number,
      voidedOn: voidedInvoice.voidOn,
      state: voidedInvoice.state
    };
  }
}
```

### E-commerce Platform Integration

```typescript
import { EZPayInvoiceGateway, InvoiceCarriers, TaxType, CustomsMark } from '@rytass/invoice-adapter-ezpay';

class EcommerceInvoiceProcessor {
  constructor(private gateway: EZPayInvoiceGateway) {}

  async processOrderInvoice(order: {
    id: string;
    type: 'b2c' | 'b2b';
    customer: {
      name: string;
      email?: string;
      vatNumber?: string;
      address?: string;
      preferences: {
        carrier?: 'print' | 'mobile' | 'love_code';
        carrierCode?: string;
      };
    };
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      category: string;
      isExport: boolean;
    }>;
    shipping: {
      isExport: boolean;
    };
  }) {
    // Validate carrier preferences
    if (order.customer.preferences.carrier === 'mobile' && order.customer.preferences.carrierCode) {
      const isValidBarcode = await this.gateway.isMobileBarcodeValid(order.customer.preferences.carrierCode);
      if (!isValidBarcode) {
        throw new Error('Invalid mobile barcode provided');
      }
    }

    // Determine carrier
    let carrier = InvoiceCarriers.PRINT;
    if (order.type === 'b2c') {
      switch (order.customer.preferences.carrier) {
        case 'mobile':
          if (order.customer.preferences.carrierCode) {
            carrier = InvoiceCarriers.MOBILE(order.customer.preferences.carrierCode);
          }
          break;
        case 'love_code':
          if (order.customer.preferences.carrierCode) {
            const isValidLoveCode = await this.gateway.isLoveCodeValid(order.customer.preferences.carrierCode);
            if (isValidLoveCode) {
              carrier = InvoiceCarriers.LOVE_CODE(order.customer.preferences.carrierCode);
            }
          }
          break;
      }
    }

    // Map items with appropriate tax types
    const invoiceItems = order.items.map(item => ({
      name: item.name,
      unitPrice: item.price,
      quantity: item.quantity,
      unit: '個',
      taxType: item.isExport ? TaxType.ZERO_TAX : TaxType.TAXED
    }));

    // Prepare invoice options
    const invoiceOptions = {
      orderId: order.id,
      buyerName: order.customer.name,
      buyerEmail: order.customer.email,
      carrier,
      items: invoiceItems,
      customsMark: order.shipping.isExport ? CustomsMark.YES : CustomsMark.NO
    };

    // Add B2B specific fields
    if (order.type === 'b2b') {
      Object.assign(invoiceOptions, {
        vatNumber: order.customer.vatNumber,
        buyerAddress: order.customer.address
      });
    }

    const invoice = await this.gateway.issue(invoiceOptions as any);

    // Store invoice reference
    await this.storeInvoiceReference(order.id, invoice.number, invoice.randomCode);

    return {
      invoiceNumber: invoice.number,
      randomCode: invoice.randomCode,
      amount: invoice.amount,
      taxAmount: invoice.taxAmount,
      qrCodeLeft: invoice.qrCodeLeft,
      qrCodeRight: invoice.qrCodeRight
    };
  }

  private async storeInvoiceReference(orderId: string, invoiceNumber: string, randomCode: string) {
    // Implementation to store invoice-order relationship in database
  }
}
```

## Best Practices

### Configuration Management
- Store sensitive credentials in environment variables
- Use different configurations for development and production
- Implement proper error handling for credential validation
- Regularly rotate API keys and credentials

### Invoice Processing
- Always validate mobile barcodes and love codes before invoice issuance
- Implement proper error handling for all EZPay API calls
- Store invoice numbers and random codes for future reference
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
- Monitor API rate limits and implement throttling

### Security
- Validate all input parameters before processing
- Sanitize customer data and item information
- Log all invoice operations for audit purposes
- Implement proper access controls for invoice management

## Testing

```typescript
import { EZPayInvoiceGateway, EZPayBaseUrls, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-ezpay';

describe('EZPay Invoice Integration', () => {
  let gateway: EZPayInvoiceGateway;

  beforeEach(() => {
    gateway = new EZPayInvoiceGateway({
      hashKey: 'test_hash_key',
      hashIv: 'test_hash_iv',
      merchantId: 'test_merchant',
      baseUrl: EZPayBaseUrls.DEVELOPMENT
    });
  });

  it('should issue B2C invoice successfully', async () => {
    const invoice = await gateway.issue({
      orderId: 'TEST-001',
      buyerName: 'Test Customer',
      carrier: InvoiceCarriers.PRINT,
      items: [
        {
          name: 'Test Product',
          unitPrice: 1000,
          quantity: 1,
          taxType: TaxType.TAXED
        }
      ]
    });

    expect(invoice.number).toBeDefined();
    expect(invoice.amount).toBe(1050); // Including 5% tax
    expect(invoice.state).toBe(InvoiceState.ISSUED);
  });

  it('should validate mobile barcode', async () => {
    const isValid = await gateway.isMobileBarcodeValid('/ABC123');
    expect(typeof isValid).toBe('boolean');
  });

  it('should query invoice by number', async () => {
    const queriedInvoice = await gateway.query({
      invoiceNumber: 'ZZ12345678',
      randomCode: '1234'
    });

    expect(queriedInvoice.number).toBe('ZZ12345678');
  });
});
```

## License

MIT
