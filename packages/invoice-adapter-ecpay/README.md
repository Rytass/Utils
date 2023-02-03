# Rytass Utils - Invoices (ECPay)

## Features

- [x] Issue Invoice
- [x] Validate Mobile Barcode
- [x] Validate Love Code
- [ ] Query
- [ ] Void
- [ ] Allowance

## Getting Started

### Issue Invoice

```typescript
import { ECPayInvoiceGateway, InvoiceCarriers } from '@rytass/invoice-adapter-ecpay';

const MERCHANT_ID = 'YOUR_ECPAY_MERCHANT_ID';
const AES_KEY = 'YOUR_ECPAY_AES_KEY';
const AES_IV = 'YOUR_ECPAY_AES_IV';

const invoiceGateway = new ECPayInvoiceGateway({
  aesIv: AES_IV,
  aesKey: AES_KEY,
  merchantId: MERCHANT_ID,
});

invoiceGateway.issue({
  orderId: '2022062900001',
  customer: {
    email: 'test@fake.com',
  },
  items: [{
    name: '橡皮擦',
    quantity: 1,
    unitPrice: 10, // Taxed Price
  }],
}).then((invoice) => {
  // Issued invoice
});

// With Mobile Barcode Carrier
invoiceGateway.issue({
  orderId: '2022062900002',
  customer: {
    email: 'test@fake.com',
  },
  carrier: InvoiceCarriers.MOBILE('/-F-K0PR'),
  items: [{
    name: 'Pencil',
    quantity: 1,
    unitPrice: 20, // Taxed Price
  }],
});

// With VAT number
invoiceGateway.issue({
  orderId: '2022062900002',
  vatNumber: '54366906',
  carrier: InvoiceCarriers.PRINT, // Always PRINT if vatNumber mode
  customer: {
    name: '八拍子股份有限公司',
    address: '台北市中山區中山北路二段72巷21號',
    email: 'test@fake.com',
  },
  items: [{
    name: 'Pencil',
    quantity: 1,
    unitPrice: 20,
  }],
});
```

### Query Invoice

```typescript
// Query with invoice number and issue date (date only, no time)
invoiceGateway.query({
  invoiceNumber: 'ZZ12345678',
  issuedOn: new Date(),
});

// Query with order id
invoiceGateway.query({
  orderId: '48f0d90c9039e8',
});
```
