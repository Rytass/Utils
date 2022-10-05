# Rytass Utils - Invoices (EZPay)

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
import { EZPayInvoiceGateway, InvoiceCarriers, InvoiceCarrierType, EZPayBaseUrls } from '@rytass/invoice-adapter-ezpay';

const MERCHANT_ID = 'YOUR_EZPAY_MERCHANT_ID';
const AES_KEY = 'YOUR_EZPAY_AES_KEY';
const AES_IV = 'YOUR_EZPAY_AES_IV';

const invoiceGateway = new EZPayInvoiceGateway({
  hashIv: AES_IV,
  hashKey: AES_KEY,
  merchantId: MERCHANT_ID,
  baseUrl: EZPayBaseUrls.PRODUCTION,
});

invoiceGateway.issue({
  orderId: '2022062900001',
  buyerEmail: 'test@fake.com',
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
  buyerName: '八拍子股份有限公司',
  buyerAddress: '台北市中山區中山北路二段72巷21號',
  buyerEmail: 'test@fake.com',
  items: [{
    name: 'Pencil',
    quantity: 1,
    unitPrice: 20,
  }],
});
```
