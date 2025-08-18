# Rytass Utils - ECPay Invoice Adapter

Comprehensive invoice management adapter for ECPay's Taiwan electronic invoice system. Provides unified invoice issuance, querying, and management functionality with support for various carrier types, VAT numbers, and Taiwan's electronic invoice regulations.

## Features

- [x] Electronic invoice issuance
- [x] Mobile barcode carrier support
- [x] Digital certificate (Moica) carrier support
- [x] Print invoice support
- [x] VAT number validation and business invoices
- [x] Love code (donation) validation
- [x] Invoice query by order ID or invoice number
- [x] Invoice void and cancellation
- [x] Allowance (credit note) creation
- [x] Multi-tax type support (taxed, tax-free, zero-rate)
- [x] Automatic customs mark calculation
- [x] B2B and B2C invoice handling

## Installation

```bash
npm install @rytass/invoice-adapter-ecpay
# or
yarn add @rytass/invoice-adapter-ecpay
```

## Basic Usage

### Gateway Setup

```typescript
import { ECPayInvoiceGateway } from '@rytass/invoice-adapter-ecpay';

const invoiceGateway = new ECPayInvoiceGateway({
  merchantId: 'YOUR_ECPAY_MERCHANT_ID',
  aesKey: 'YOUR_ECPAY_AES_KEY',
  aesIv: 'YOUR_ECPAY_AES_IV',
  baseUrl: 'https://einvoice.ecpay.com.tw', // Production
  // baseUrl: 'https://einvoice-stage.ecpay.com.tw', // Staging
});
```

### Basic Invoice Issuance

```typescript
// Issue a simple B2C invoice
const invoice = await invoiceGateway.issue({
  orderId: '2024081400001',
  customer: {
    email: 'customer@example.com'
  },
  items: [
    {
      name: 'Premium Software License',
      quantity: 1,
      unitPrice: 1500 // Tax-included price
    },
    {
      name: 'Technical Support',
      quantity: 12,
      unitPrice: 200
    }
  ]
});

console.log('Invoice Number:', invoice.invoiceNumber);
console.log('Issue Date:', invoice.issuedOn);
console.log('QR Code:', invoice.qrCode);
```

## Invoice Carrier Types

### Mobile Barcode Carrier

```typescript
import { InvoiceCarriers } from '@rytass/invoice-adapter-ecpay';

// Issue invoice with mobile barcode carrier
const invoice = await invoiceGateway.issue({
  orderId: '2024081400002',
  customer: {
    email: 'customer@example.com'
  },
  carrier: InvoiceCarriers.MOBILE('/-F-K0PR'), // Mobile barcode
  items: [
    {
      name: 'Coffee Beans',
      quantity: 2,
      unitPrice: 350
    }
  ]
});
```

### Digital Certificate (Moica) Carrier

```typescript
// Issue invoice with digital certificate carrier
const invoice = await invoiceGateway.issue({
  orderId: '2024081400003',
  customer: {
    email: 'customer@example.com'
  },
  carrier: InvoiceCarriers.MOICA('AB12345678901234'), // Digital certificate
  items: [
    {
      name: 'Online Course',
      quantity: 1,
      unitPrice: 2999
    }
  ]
});
```

### Print Invoice

```typescript
// Issue print invoice (traditional paper invoice)
const invoice = await invoiceGateway.issue({
  orderId: '2024081400004',
  customer: {
    name: 'John Doe',
    address: 'No. 123, Section 1, Roosevelt Rd., Taipei City',
    email: 'customer@example.com'
  },
  carrier: InvoiceCarriers.PRINT,
  items: [
    {
      name: 'Hardware Component',
      quantity: 1,
      unitPrice: 5000
    }
  ]
});
```

## Business-to-Business (B2B) Invoices

### VAT Number Invoice

```typescript
// Issue B2B invoice with VAT number
const businessInvoice = await invoiceGateway.issue({
  orderId: '2024081400005',
  vatNumber: '12345678', // Company VAT number
  carrier: InvoiceCarriers.PRINT, // B2B invoices must be print
  customer: {
    name: 'ABC Technology Co., Ltd.',
    address: 'No. 456, Section 2, Zhongshan N. Rd., Taipei City 104',
    email: 'accounting@abctech.com.tw'
  },
  items: [
    {
      name: 'Enterprise Software License',
      quantity: 10,
      unitPrice: 15000
    },
    {
      name: 'Implementation Service',
      quantity: 1,
      unitPrice: 50000
    }
  ]
});
```

### VAT Number Validation

```typescript
// Validate VAT number before invoice issuance
const [isValid, companyName] = await invoiceGateway.isValidGUI('12345678');

if (isValid) {
  console.log('Valid VAT number for:', companyName);
  // Proceed with B2B invoice
} else {
  console.log('Invalid VAT number');
}
```

## Carrier Validation

### Mobile Barcode Validation

```typescript
// Validate mobile barcode before use
const isValidMobile = await invoiceGateway.isValidMobileBarcode('/-F-K0PR');

if (isValidMobile) {
  // Proceed with mobile carrier invoice
} else {
  console.log('Invalid mobile barcode');
}
```

### Love Code Validation

```typescript
// Validate donation code (love code)
const isValidLoveCode = await invoiceGateway.isValidLoveCode('001');

if (isValidLoveCode) {
  // Issue donation invoice
  const donationInvoice = await invoiceGateway.issue({
    orderId: '2024081400006',
    customer: { email: 'donor@example.com' },
    loveCode: '001', // NPO donation code
    items: [
      {
        name: 'Charity Donation',
        quantity: 1,
        unitPrice: 1000
      }
    ]
  });
} else {
  console.log('Invalid love code');
}
```

## Multi-Tax Type Support

### Mixed Tax Types

```typescript
import { TaxType } from '@rytass/invoice-adapter-ecpay';

// Invoice with mixed tax types
const mixedTaxInvoice = await invoiceGateway.issue({
  orderId: '2024081400007',
  customer: { email: 'customer@example.com' },
  items: [
    {
      name: 'Taxable Product',
      quantity: 1,
      unitPrice: 100,
      taxType: TaxType.TAXED
    },
    {
      name: 'Tax-free Service',
      quantity: 1,
      unitPrice: 200,
      taxType: TaxType.TAX_FREE
    },
    {
      name: 'Zero-rate Export',
      quantity: 1,
      unitPrice: 300,
      taxType: TaxType.ZERO_RATE
    }
  ]
});
```

## Invoice Management

### Query Invoice

```typescript
// Query by invoice number and issue date
const invoiceByNumber = await invoiceGateway.query({
  invoiceNumber: 'ZZ12345678',
  issuedOn: new Date('2024-08-14')
});

// Query by order ID
const invoiceByOrderId = await invoiceGateway.query({
  orderId: '2024081400001'
});

console.log('Invoice Status:', invoiceByOrderId.state);
console.log('Total Amount:', invoiceByOrderId.totalAmount);
```

### Void Invoice

```typescript
// Void (cancel) an issued invoice
const voidResult = await invoiceGateway.void({
  invoiceNumber: 'ZZ12345678',
  reason: 'Customer cancellation'
});

if (voidResult.success) {
  console.log('Invoice voided successfully');
} else {
  console.log('Void failed:', voidResult.message);
}
```

## Allowances (Credit Notes)

### Issue Allowance

```typescript
// Issue allowance for partial refund
const allowance = await invoiceGateway.issueAllowance({
  invoiceNumber: 'ZZ12345678',
  buyerEmail: 'customer@example.com',
  items: [
    {
      name: 'Partial Refund - Product Return',
      quantity: 1,
      unitPrice: 500 // Allowance amount
    }
  ],
  reason: 'Product defect'
});

console.log('Allowance Number:', allowance.allowanceNumber);
```

### Void Allowance

```typescript
// Void an issued allowance
const voidAllowanceResult = await invoiceGateway.voidAllowance({
  allowanceNumber: 'AL12345678',
  reason: 'Incorrect allowance amount'
});
```

## Configuration Options

### ECPayInvoiceGatewayOptions

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `merchantId` | `string` | Yes | - | ECPay merchant ID |
| `aesKey` | `string` | Yes | - | AES encryption key |
| `aesIv` | `string` | Yes | - | AES initialization vector |
| `baseUrl` | `string` | No | Development | API base URL |
| `skipMobileBarcodeValidation` | `boolean` | No | `false` | Skip mobile barcode validation |
| `skipLoveCodeValidation` | `boolean` | No | `false` | Skip love code validation |

## Environment Configuration

```bash
# .env
ECPAY_MERCHANT_ID=your_merchant_id
ECPAY_AES_KEY=your_aes_key
ECPAY_AES_IV=your_aes_iv
ECPAY_ENVIRONMENT=production # or development
```

```typescript
const invoiceGateway = new ECPayInvoiceGateway({
  merchantId: process.env.ECPAY_MERCHANT_ID!,
  aesKey: process.env.ECPAY_AES_KEY!,
  aesIv: process.env.ECPAY_AES_IV!,
  baseUrl: process.env.ECPAY_ENVIRONMENT === 'production' 
    ? 'https://einvoice.ecpay.com.tw'
    : 'https://einvoice-stage.ecpay.com.tw'
});
```

## Advanced Features

### Custom Remark and Notes

```typescript
const invoice = await invoiceGateway.issue({
  orderId: '2024081400008',
  customer: { email: 'customer@example.com' },
  items: [{ name: 'Product', quantity: 1, unitPrice: 100 }],
  remark: 'Special order - urgent delivery',
  customerNote: 'Thank you for your business!'
});
```

### Customs Declaration

```typescript
import { CustomsMark } from '@rytass/invoice-adapter-ecpay';

// For export invoices requiring customs declaration
const exportInvoice = await invoiceGateway.issue({
  orderId: '2024081400009',
  customer: { email: 'international@example.com' },
  customsMark: CustomsMark.CUSTOMS_REQUIRED,
  items: [
    {
      name: 'Export Product',
      quantity: 5,
      unitPrice: 1000,
      taxType: TaxType.ZERO_RATE
    }
  ]
});
```

### Batch Operations

```typescript
// Issue multiple invoices in sequence
const orderIds = ['ORDER_001', 'ORDER_002', 'ORDER_003'];
const invoices = [];

for (const orderId of orderIds) {
  const invoice = await invoiceGateway.issue({
    orderId,
    customer: { email: 'batch@example.com' },
    items: [{ name: 'Batch Item', quantity: 1, unitPrice: 100 }]
  });
  invoices.push(invoice);
}

console.log(`Successfully issued ${invoices.length} invoices`);
```

## Error Handling

```typescript
import { ECPayInvoiceError } from '@rytass/invoice-adapter-ecpay';

try {
  const invoice = await invoiceGateway.issue({
    orderId: 'INVALID_ORDER',
    customer: { email: 'invalid-email' },
    items: []
  });
} catch (error) {
  if (error instanceof ECPayInvoiceError) {
    console.error('ECPay Error Code:', error.code);
    console.error('Error Message:', error.message);
    
    switch (error.code) {
      case '10000999':
        console.log('System error - please try again later');
        break;
      case '10002003':
        console.log('Invalid merchant ID');
        break;
      case '10002004':
        console.log('Duplicate order ID');
        break;
      default:
        console.log('Unknown error occurred');
    }
  }
}
```

## Testing

### Development Environment

```typescript
// Use ECPay's test environment
const testGateway = new ECPayInvoiceGateway({
  merchantId: '2000132', // Test merchant ID
  aesKey: 'ejCk326UnaZWKisg', // Test AES key
  aesIv: 'q9jcZX8Ib9LM8wYk', // Test AES IV
  baseUrl: 'https://einvoice-stage.ecpay.com.tw'
});

// Test invoice issuance
const testInvoice = await testGateway.issue({
  orderId: 'TEST_' + Date.now(),
  customer: { email: 'test@example.com' },
  items: [{ name: 'Test Product', quantity: 1, unitPrice: 100 }]
});
```

### Test Data

Use these test values for development:

- **Test Mobile Barcode**: `/-F-K0PR`
- **Test VAT Number**: `54366906`
- **Test Love Code**: `001`

## Integration Examples

### E-commerce Integration

```typescript
class OrderService {
  constructor(
    private invoiceGateway: ECPayInvoiceGateway,
    private orderRepository: OrderRepository
  ) {}

  async completeOrder(orderId: string) {
    const order = await this.orderRepository.findById(orderId);
    
    if (!order) throw new Error('Order not found');

    try {
      // Issue invoice after payment confirmation
      const invoice = await this.invoiceGateway.issue({
        orderId: order.id,
        customer: {
          email: order.customerEmail,
          name: order.customerName
        },
        items: order.items.map(item => ({
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })),
        carrier: order.invoiceCarrier
      });

      // Save invoice information
      await this.orderRepository.updateInvoice(orderId, {
        invoiceNumber: invoice.invoiceNumber,
        issuedOn: invoice.issuedOn
      });

      return { success: true, invoice };
    } catch (error) {
      console.error('Invoice issuance failed:', error);
      return { success: false, error: error.message };
    }
  }
}
```

### NestJS Integration

```typescript
import { Injectable } from '@nestjs/common';
import { ECPayInvoiceGateway } from '@rytass/invoice-adapter-ecpay';

@Injectable()
export class InvoiceService {
  private readonly invoiceGateway: ECPayInvoiceGateway;

  constructor() {
    this.invoiceGateway = new ECPayInvoiceGateway({
      merchantId: process.env.ECPAY_MERCHANT_ID!,
      aesKey: process.env.ECPAY_AES_KEY!,
      aesIv: process.env.ECPAY_AES_IV!,
      baseUrl: process.env.ECPAY_INVOICE_BASE_URL!
    });
  }

  async issueInvoice(orderData: any) {
    return await this.invoiceGateway.issue(orderData);
  }

  async queryInvoice(params: any) {
    return await this.invoiceGateway.query(params);
  }
}
```

## Best Practices

### Security
- Store sensitive credentials in environment variables
- Use production URLs only in production environment
- Implement proper error handling and logging
- Validate input data before API calls

### Performance
- Cache validation results for frequently used codes
- Implement retry mechanisms for network failures
- Use batch processing for multiple operations
- Monitor API rate limits

### Compliance
- Follow Taiwan electronic invoice regulations
- Ensure proper VAT calculations
- Maintain audit trails for all invoice operations
- Regular reconciliation with ECPay reports

## License

MIT