# Rytass Utils - Invoice Adapter Bank Pro

A comprehensive Bank Pro electronic invoice integration adapter for Taiwan's electronic invoice system. This adapter provides seamless integration with Bank Pro's B2B2C Web API, supporting complete invoice lifecycle management with robust tax compliance and carrier support.

## Features

- [x] Complete Bank Pro B2B2C Web API integration
- [x] B2B and B2C invoice issuance
- [x] Invoice query functionality (by order ID or invoice number)
- [x] Invoice voiding operations
- [x] Invoice allowance (partial refund) management
- [x] Allowance invalidation support
- [x] Multiple carrier type support
- [x] Tax calculation and validation
- [x] Detailed product information support
- [x] Email notification integration
- [x] Production and development environment support
- [x] TypeScript type safety
- [x] Comprehensive error handling

## Installation

```bash
npm install @rytass/invoice-adapter-bank-pro
# or
yarn add @rytass/invoice-adapter-bank-pro
```

**Peer Dependencies:**
```bash
npm install @rytass/invoice
```

## Configuration

### Environment Setup

```typescript
import { BankProInvoiceGateway, BankProBaseUrls } from '@rytass/invoice-adapter-bank-pro';

// Development environment
const developmentGateway = new BankProInvoiceGateway({
  user: 'YOUR_DEVELOPMENT_USER',
  password: 'YOUR_DEVELOPMENT_PASSWORD',
  systemOID: 12345, // Your development system OID
  sellerBAN: '12345678', // Your company VAT number
  baseUrl: BankProBaseUrls.DEVELOPMENT // http://webtest.bpscm.com.tw/webapi/api/B2B2CWebApi
});

// Production environment
const productionGateway = new BankProInvoiceGateway({
  user: 'YOUR_PRODUCTION_USER',
  password: 'YOUR_PRODUCTION_PASSWORD',
  systemOID: 54321, // Your production system OID
  sellerBAN: '12345678', // Your company VAT number
  baseUrl: BankProBaseUrls.PRODUCTION // http://www.bpscm.com.tw/webapi/api/B2B2CWebApi
});
```

### Configuration Options

```typescript
interface BankProInvoiceGatewayOptions {
  user: string;          // Bank Pro API user ID
  password: string;      // Bank Pro API password
  systemOID: number;     // Bank Pro system identifier
  sellerBAN: string;     // Seller's VAT number (統編)
  baseUrl?: BankProBaseUrls; // API base URL (development/production)
}
```

## Basic Usage

### B2C Invoice Issuance

```typescript
import { BankProInvoiceGateway, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-bank-pro';

const gateway = new BankProInvoiceGateway({
  user: process.env.BANKPRO_USER!,
  password: process.env.BANKPRO_PASSWORD!,
  systemOID: parseInt(process.env.BANKPRO_SYSTEM_OID!),
  sellerBAN: process.env.SELLER_VAT_NUMBER!,
  baseUrl: BankProBaseUrls.PRODUCTION
});

// Issue B2C invoice
const invoice = await gateway.issue({
  orderId: 'ORD-2024-001',
  buyerEmail: 'customer@example.com',
  buyerName: 'Customer Name',
  buyerAddress: '台北市信義區信義路五段7號',
  buyerZipCode: '110',
  buyerMobile: '0912345678',
  carrier: InvoiceCarriers.PRINT,
  items: [
    {
      name: 'Premium Product',
      unitPrice: 2000,
      quantity: 1,
      unit: '個',
      taxType: TaxType.TAXED,
      id: 'PROD-001',
      barcode: '1234567890123',
      spec: '高級款',
      remark: '限量商品'
    },
    {
      name: 'Standard Service',
      unitPrice: 1500,
      quantity: 2,
      unit: '次',
      taxType: TaxType.TAXED,
      id: 'SRV-001'
    }
  ]
});

console.log('Invoice Number:', invoice.number);
console.log('Random Code:', invoice.randomCode);
console.log('Total Amount:', invoice.amount);
```

### B2B Invoice Issuance

```typescript
// B2B invoice with company information
const b2bInvoice = await gateway.issue({
  orderId: 'B2B-2024-001',
  vatNumber: '12345678', // Buyer's VAT number
  companyName: '採購公司股份有限公司',
  buyerEmail: 'procurement@buyer-company.com.tw',
  buyerName: '採購部經理',
  buyerAddress: '新北市板橋區文化路二段242號',
  buyerZipCode: '220',
  carrier: InvoiceCarriers.PRINT,
  sellerCode: 'SELLER-001', // Optional seller code
  remark: 'B2B訂單 - 月結30天',
  items: [
    {
      name: '企業方案服務',
      unitPrice: 50000,
      quantity: 1,
      unit: '年',
      taxType: TaxType.TAXED,
      id: 'ENT-PLAN-001',
      spec: '專業版',
      remark: '包含技術支援'
    },
    {
      name: '客製化開發',
      unitPrice: 100000,
      quantity: 1,
      unit: '式',
      taxType: TaxType.TAXED,
      id: 'CUSTOM-DEV-001'
    }
  ]
});
```

### Invoice with Mobile Carrier

```typescript
// Issue invoice with mobile barcode carrier
const mobileInvoice = await gateway.issue({
  orderId: 'MOBILE-2024-001',
  buyerEmail: 'mobile-user@example.com',
  buyerName: 'Mobile User',
  carrier: InvoiceCarriers.MOBILE('/ABC12345'),
  items: [
    {
      name: 'Digital Product',
      unitPrice: 1200,
      quantity: 1,
      unit: '個',
      taxType: TaxType.TAXED
    }
  ]
});
```

### Invoice with Love Code (Donation)

```typescript
// Issue invoice with donation to charity
const donationInvoice = await gateway.issue({
  orderId: 'DONATION-2024-001',
  buyerEmail: 'donor@example.com',
  buyerName: 'Charitable Donor',
  carrier: InvoiceCarriers.LOVE_CODE('001'),
  items: [
    {
      name: 'Charity Purchase',
      unitPrice: 1000,
      quantity: 3,
      unit: '份',
      taxType: TaxType.TAXED
    }
  ]
});
```

## Advanced Usage

### Mixed Tax Type Items

```typescript
const mixedTaxInvoice = await gateway.issue({
  orderId: 'MIXED-2024-001',
  buyerEmail: 'export@customer.com',
  buyerName: 'Export Customer',
  buyerAddress: 'Export Address',
  customsMark: CustomsMark.YES,
  carrier: InvoiceCarriers.PRINT,
  items: [
    {
      name: 'Domestic Product',
      unitPrice: 1000,
      quantity: 2,
      taxType: TaxType.TAXED, // 5% tax
      unit: '個'
    },
    {
      name: 'Tax-Free Product',
      unitPrice: 2000,
      quantity: 1,
      taxType: TaxType.TAX_FREE, // No tax
      unit: '件'
    },
    {
      name: 'Export Product',
      unitPrice: 3000,
      quantity: 1,
      taxType: TaxType.ZERO_TAX, // Export (0% tax)
      unit: '組'
    }
  ]
});
```

### Detailed Product Information

```typescript
const detailedInvoice = await gateway.issue({
  orderId: 'DETAILED-2024-001',
  buyerEmail: 'detailed@customer.com',
  buyerName: 'Detail Customer',
  carrier: InvoiceCarriers.PRINT,
  items: [
    {
      name: 'Smart Phone',
      unitPrice: 25000,
      quantity: 1,
      unit: '支',
      taxType: TaxType.TAXED,
      id: 'PHONE-001',
      barcode: '4710543211234',
      spec: '128GB 藍色',
      remark: '保固一年'
    },
    {
      name: 'Phone Case',
      unitPrice: 500,
      quantity: 2,
      unit: '個',
      taxType: TaxType.TAXED,
      id: 'CASE-001',
      barcode: '4710543211241',
      spec: '透明矽膠',
      remark: '防摔保護'
    }
  ]
});
```

## Query Operations

### Query by Order ID

```typescript
// Query invoice using order ID
const queriedByOrder = await gateway.query({
  orderId: 'ORD-2024-001'
});

console.log('Invoice Number:', queriedByOrder.number);
console.log('Invoice State:', queriedByOrder.state);
console.log('Invoice Amount:', queriedByOrder.amount);
console.log('Tax Amount:', queriedByOrder.taxAmount);
```

### Query by Invoice Number

```typescript
// Query invoice using invoice number
const queriedByNumber = await gateway.query({
  invoiceNumber: 'AA12345678'
});

console.log('Order ID:', queriedByNumber.orderId);
console.log('Random Code:', queriedByNumber.randomCode);
console.log('Issued On:', queriedByNumber.issuedOn);
console.log('Void Status:', queriedByNumber.state);
```

## Invoice Management

### Invoice Voiding

```typescript
// Query and void an invoice
const invoiceToVoid = await gateway.query({
  orderId: 'ORD-2024-001'
});

const voidedInvoice = await gateway.void(invoiceToVoid, {
  reason: 'Customer requested cancellation due to shipping delay'
});

console.log('Void Status:', voidedInvoice.state); // InvoiceState.VOID
console.log('Voided On:', voidedInvoice.voidOn);
```

### Invoice Allowance (Partial Refund)

```typescript
// Create allowance for partial refund
const originalInvoice = await gateway.query({
  orderId: 'ORD-2024-001'
});

const allowanceInvoice = await gateway.allowance(
  originalInvoice,
  [
    {
      name: 'Returned Product',
      unitPrice: 2000,
      quantity: 1, // Return 1 item
      unit: '個',
      taxType: TaxType.TAXED,
      id: 'RETURN-001'
    }
  ]
);

console.log('Allowance Number:', allowanceInvoice.allowances[0].number);
console.log('Allowance Amount:', allowanceInvoice.allowances[0].amount);
console.log('Remaining Amount:', allowanceInvoice.allowances[0].remainingAmount);
```

### Invalidate Allowance

```typescript
// Invalidate a previously issued allowance
const allowanceToInvalidate = allowanceInvoice.allowances[0];
const updatedInvoice = await gateway.invalidAllowance(allowanceToInvalidate);

console.log('Allowance invalidated:', updatedInvoice.allowances[0].invalidatedOn);
```

## Error Handling

### Bank Pro Specific Errors

```typescript
try {
  const invoice = await gateway.issue({
    orderId: 'ERROR-TEST',
    buyerEmail: 'test@example.com',
    carrier: InvoiceCarriers.PRINT,
    items: [/* invalid items */]
  });
} catch (error) {
  if (error.message.includes('authentication failed')) {
    console.error('Bank Pro authentication failed - check credentials');
  } else if (error.message.includes('system unavailable')) {
    console.error('Bank Pro system temporarily unavailable');
  } else if (error.message.includes('duplicate order')) {
    console.error('Order ID already exists - use different order ID');
  } else if (error.message.includes('invalid VAT number')) {
    console.error('Buyer VAT number validation failed');
  } else {
    console.error('Invoice issuance failed:', error.message);
  }
}
```

### Network and System Errors

```typescript
async function safeInvoiceOperation<T>(
  operation: () => Promise<T>,
  retries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      
      if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
        console.warn(`Network error on attempt ${attempt}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        throw error; // Don't retry non-network errors
      }
    }
  }
  
  throw new Error('All retry attempts failed');
}

// Usage with retry logic
const invoice = await safeInvoiceOperation(() =>
  gateway.issue({
    orderId: 'RETRY-001',
    buyerEmail: 'customer@example.com',
    carrier: InvoiceCarriers.PRINT,
    items: [/* items */]
  })
);
```

## Integration Examples

### Express.js API Integration

```typescript
import express from 'express';
import { BankProInvoiceGateway, BankProBaseUrls, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-bank-pro';

const app = express();
const gateway = new BankProInvoiceGateway({
  user: process.env.BANKPRO_USER!,
  password: process.env.BANKPRO_PASSWORD!,
  systemOID: parseInt(process.env.BANKPRO_SYSTEM_OID!),
  sellerBAN: process.env.SELLER_VAT_NUMBER!,
  baseUrl: process.env.NODE_ENV === 'production' 
    ? BankProBaseUrls.PRODUCTION 
    : BankProBaseUrls.DEVELOPMENT
});

// Issue invoice endpoint
app.post('/api/invoices', async (req, res) => {
  try {
    const { orderId, customer, items, isB2B } = req.body;

    const invoiceData = {
      orderId,
      buyerEmail: customer.email,
      buyerName: customer.name,
      buyerAddress: customer.address,
      buyerZipCode: customer.zipCode,
      buyerMobile: customer.mobile,
      carrier: customer.mobileBarcode 
        ? InvoiceCarriers.MOBILE(customer.mobileBarcode)
        : InvoiceCarriers.PRINT,
      items: items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        unit: item.unit || '個',
        taxType: TaxType.TAXED,
        id: item.productId,
        barcode: item.barcode,
        spec: item.specification,
        remark: item.notes
      }))
    };

    // Add B2B specific fields
    if (isB2B && customer.vatNumber) {
      Object.assign(invoiceData, {
        vatNumber: customer.vatNumber,
        companyName: customer.companyName
      });
    }

    const invoice = await gateway.issue(invoiceData as any);

    res.json({
      success: true,
      invoice: {
        number: invoice.number,
        randomCode: invoice.randomCode,
        amount: invoice.amount,
        taxAmount: invoice.taxAmount,
        issuedOn: invoice.issuedOn
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Query invoice endpoint
app.get('/api/invoices/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const invoice = await gateway.query({ orderId });
    
    res.json({
      success: true,
      invoice: {
        number: invoice.number,
        orderId: invoice.orderId,
        state: invoice.state,
        amount: invoice.amount,
        issuedOn: invoice.issuedOn
      }
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Invoice not found'
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
        voidedOn: voidedInvoice.voidOn
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

### NestJS Service Integration

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { BankProInvoiceGateway, BankProBaseUrls, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-bank-pro';

@Injectable()
export class BankProInvoiceService {
  private readonly gateway: BankProInvoiceGateway;

  constructor() {
    this.gateway = new BankProInvoiceGateway({
      user: process.env.BANKPRO_USER!,
      password: process.env.BANKPRO_PASSWORD!,
      systemOID: parseInt(process.env.BANKPRO_SYSTEM_OID!),
      sellerBAN: process.env.SELLER_VAT_NUMBER!,
      baseUrl: process.env.NODE_ENV === 'production' 
        ? BankProBaseUrls.PRODUCTION 
        : BankProBaseUrls.DEVELOPMENT
    });
  }

  async createInvoiceForOrder(order: {
    id: string;
    customer: {
      email: string;
      name: string;
      address?: string;
      zipCode?: string;
      mobile?: string;
      vatNumber?: string;
      companyName?: string;
      mobileBarcode?: string;
    };
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      unit?: string;
      productId?: string;
      barcode?: string;
      specification?: string;
      notes?: string;
    }>;
    notes?: string;
  }) {
    // Determine invoice type
    const isB2B = !!order.customer.vatNumber;
    
    // Determine carrier
    let carrier = InvoiceCarriers.PRINT;
    if (!isB2B && order.customer.mobileBarcode) {
      // Validate mobile barcode if needed
      const isValid = await this.gateway.isMobileBarcodeValid(order.customer.mobileBarcode);
      if (isValid) {
        carrier = InvoiceCarriers.MOBILE(order.customer.mobileBarcode);
      }
    }

    // Prepare invoice data
    const invoiceData = {
      orderId: order.id,
      buyerEmail: order.customer.email,
      buyerName: order.customer.name,
      buyerAddress: order.customer.address,
      buyerZipCode: order.customer.zipCode,
      buyerMobile: order.customer.mobile,
      carrier,
      remark: order.notes,
      items: order.items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        unit: item.unit || '個',
        taxType: TaxType.TAXED,
        id: item.productId,
        barcode: item.barcode,
        spec: item.specification,
        remark: item.notes
      }))
    };

    // Add B2B specific fields
    if (isB2B) {
      Object.assign(invoiceData, {
        vatNumber: order.customer.vatNumber,
        companyName: order.customer.companyName
      });
    }

    const invoice = await this.gateway.issue(invoiceData as any);

    return {
      invoiceNumber: invoice.number,
      randomCode: invoice.randomCode,
      amount: invoice.amount,
      taxAmount: invoice.taxAmount,
      issuedOn: invoice.issuedOn
    };
  }

  async queryInvoiceByOrderId(orderId: string) {
    try {
      const invoice = await this.gateway.query({ orderId });
      return {
        invoiceNumber: invoice.number,
        orderId: invoice.orderId,
        randomCode: invoice.randomCode,
        state: invoice.state,
        amount: invoice.amount,
        taxAmount: invoice.taxAmount,
        issuedOn: invoice.issuedOn,
        voidOn: invoice.voidOn
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
      voidedOn: voidedInvoice.voidOn
    };
  }

  async createAllowance(
    orderId: string, 
    allowanceItems: Array<{
      name: string;
      price: number;
      quantity: number;
      unit?: string;
      productId?: string;
    }>
  ) {
    const originalInvoice = await this.gateway.query({ orderId });
    
    const allowanceInvoice = await this.gateway.allowance(
      originalInvoice,
      allowanceItems.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        unit: item.unit || '個',
        taxType: TaxType.TAXED,
        id: item.productId
      }))
    );

    return {
      allowanceNumber: allowanceInvoice.allowances[0].number,
      allowanceAmount: allowanceInvoice.allowances[0].amount,
      remainingAmount: allowanceInvoice.allowances[0].remainingAmount,
      allowancedOn: allowanceInvoice.allowances[0].issuedOn
    };
  }
}
```

### E-commerce Platform Integration

```typescript
import { BankProInvoiceGateway, InvoiceCarriers, TaxType, CustomsMark } from '@rytass/invoice-adapter-bank-pro';

class EcommerceBankProInvoiceProcessor {
  constructor(private gateway: BankProInvoiceGateway) {}

  async processOrderInvoice(order: {
    id: string;
    type: 'b2c' | 'b2b';
    customer: {
      email: string;
      name: string;
      address?: string;
      zipCode?: string;
      mobile?: string;
      vatNumber?: string;
      companyName?: string;
      preferences: {
        carrier?: 'print' | 'mobile' | 'love_code';
        carrierCode?: string;
      };
    };
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      unit?: string;
      category: string;
      productId: string;
      barcode?: string;
      specification?: string;
      notes?: string;
      isExport?: boolean;
    }>;
    shipping: {
      isExport?: boolean;
      notes?: string;
    };
    seller?: {
      code?: string; // Seller code for multi-vendor platforms
    };
  }) {
    // Determine carrier based on customer preferences
    let carrier = InvoiceCarriers.PRINT;
    
    if (order.type === 'b2c') {
      switch (order.customer.preferences.carrier) {
        case 'mobile':
          if (order.customer.preferences.carrierCode) {
            // Validate mobile barcode if needed
            const isValidBarcode = await this.gateway.isMobileBarcodeValid(
              order.customer.preferences.carrierCode
            );
            if (isValidBarcode) {
              carrier = InvoiceCarriers.MOBILE(order.customer.preferences.carrierCode);
            }
          }
          break;
        case 'love_code':
          if (order.customer.preferences.carrierCode) {
            const isValidLoveCode = await this.gateway.isLoveCodeValid(
              order.customer.preferences.carrierCode
            );
            if (isValidLoveCode) {
              carrier = InvoiceCarriers.LOVE_CODE(order.customer.preferences.carrierCode);
            }
          }
          break;
      }
    }

    // Map items with appropriate tax types
    const invoiceItems = order.items.map((item, index) => ({
      name: item.name,
      unitPrice: item.price,
      quantity: item.quantity,
      unit: item.unit || '個',
      taxType: item.isExport ? TaxType.ZERO_TAX : TaxType.TAXED,
      id: item.productId,
      barcode: item.barcode,
      spec: item.specification,
      remark: item.notes
    }));

    // Prepare invoice options
    const invoiceOptions = {
      orderId: order.id,
      buyerEmail: order.customer.email,
      buyerName: order.customer.name,
      buyerAddress: order.customer.address,
      buyerZipCode: order.customer.zipCode,
      buyerMobile: order.customer.mobile,
      carrier,
      sellerCode: order.seller?.code,
      remark: order.shipping.notes,
      items: invoiceItems,
      customsMark: order.shipping.isExport ? CustomsMark.YES : CustomsMark.NO
    };

    // Add B2B specific fields
    if (order.type === 'b2b') {
      Object.assign(invoiceOptions, {
        vatNumber: order.customer.vatNumber,
        companyName: order.customer.companyName
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
      issuedOn: invoice.issuedOn
    };
  }

  async processOrderRefund(
    orderId: string, 
    refundItems: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      unit?: string;
    }>
  ) {
    // Query original invoice
    const originalInvoice = await this.gateway.query({ orderId });
    
    // Create allowance for refunded items
    const allowanceInvoice = await this.gateway.allowance(
      originalInvoice,
      refundItems.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        unit: item.unit || '個',
        taxType: TaxType.TAXED,
        id: item.productId
      }))
    );

    return {
      allowanceNumber: allowanceInvoice.allowances[0].number,
      allowanceAmount: allowanceInvoice.allowances[0].amount,
      remainingAmount: allowanceInvoice.allowances[0].remainingAmount
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
- Use different configurations for development and production environments
- Regularly rotate API credentials and passwords
- Implement proper error handling for authentication failures

### Invoice Processing
- Always validate carrier information before invoice issuance
- Implement proper retry logic for network failures
- Store order IDs and invoice mappings for future reference
- Handle duplicate order IDs appropriately

### Tax Compliance
- Use correct tax types for different product categories
- Handle export/import scenarios with appropriate customs marks
- Validate VAT numbers for B2B transactions
- Maintain detailed product information for audit purposes

### Performance Optimization
- Implement connection pooling for high-volume processing
- Use appropriate timeout settings for API calls
- Cache frequently accessed invoice data
- Monitor API response times and implement alerting

### Security
- Validate all input parameters before processing
- Sanitize customer data and product information
- Log all invoice operations for audit trails
- Implement proper access controls for invoice management functions

## Testing

```typescript
import { BankProInvoiceGateway, BankProBaseUrls, InvoiceCarriers, TaxType } from '@rytass/invoice-adapter-bank-pro';

describe('Bank Pro Invoice Integration', () => {
  let gateway: BankProInvoiceGateway;

  beforeEach(() => {
    gateway = new BankProInvoiceGateway({
      user: 'test_user',
      password: 'test_password',
      systemOID: 12345,
      sellerBAN: '12345678',
      baseUrl: BankProBaseUrls.DEVELOPMENT
    });
  });

  it('should issue B2C invoice successfully', async () => {
    const invoice = await gateway.issue({
      orderId: 'TEST-001',
      buyerEmail: 'test@customer.com',
      buyerName: 'Test Customer',
      carrier: InvoiceCarriers.PRINT,
      items: [
        {
          name: 'Test Product',
          unitPrice: 1000,
          quantity: 1,
          unit: '個',
          taxType: TaxType.TAXED
        }
      ]
    });

    expect(invoice.number).toBeDefined();
    expect(invoice.amount).toBe(1050); // Including 5% tax
    expect(invoice.state).toBe(InvoiceState.ISSUED);
  });

  it('should query invoice by order ID', async () => {
    const queriedInvoice = await gateway.query({
      orderId: 'TEST-001'
    });

    expect(queriedInvoice.orderId).toBe('TEST-001');
    expect(queriedInvoice.number).toBeDefined();
  });

  it('should create allowance successfully', async () => {
    const originalInvoice = await gateway.query({
      orderId: 'TEST-001'
    });

    const allowanceInvoice = await gateway.allowance(
      originalInvoice,
      [
        {
          name: 'Returned Product',
          unitPrice: 1000,
          quantity: 1,
          unit: '個',
          taxType: TaxType.TAXED
        }
      ]
    );

    expect(allowanceInvoice.allowances).toHaveLength(1);
    expect(allowanceInvoice.allowances[0].amount).toBe(1050);
  });
});
```

## License

MIT
