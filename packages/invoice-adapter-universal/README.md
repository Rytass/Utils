# Rytass Utils - Universal Invoice Adapter

Universal electronic invoice adapter for Taiwan e-invoice integrations using 汎宇 Web API.

## Installation

```bash
yarn add @rytass/invoice-adapter-universal
```

## Usage

```typescript
import { InvoiceCarriers, TaxType, UniversalBaseUrls, UniversalInvoiceGateway } from '@rytass/invoice-adapter-universal';

const gateway = new UniversalInvoiceGateway({
  companyID: process.env.UNIVERSAL_COMPANY_ID!,
  userID: process.env.UNIVERSAL_USER_ID!,
  auth: process.env.UNIVERSAL_AUTH!,
  apiKey: process.env.UNIVERSAL_API_KEY!,
  sellerID: process.env.UNIVERSAL_SELLER_ID!,
  baseUrl: UniversalBaseUrls.PRODUCTION,
});

const invoice = await gateway.issue({
  orderId: 'ORD-20260430-001',
  buyerName: 'A123',
  buyerEmail: 'customer@example.com',
  carrier: InvoiceCarriers.MOBILE('/ABC1234'),
  items: [
    {
      name: '商品',
      unitPrice: 1050,
      quantity: 1,
      unit: '個',
      taxType: TaxType.TAXED,
    },
  ],
});
```

## Supported Gateway Methods

- `issue`
- `void`
- `allowance`
- `invalidAllowance`
- `query`
- `isMobileBarcodeValid`
- `isLoveCodeValid`

## Notes

- API requests use JSON POST.
- `auth` is accepted as plain text in gateway options and sent as Base64.
- `signatureValue` is generated with HMAC-SHA256 using `apiKey` and `createDateTime`, then Base64 encoded.
- `createDateTime` is generated in `Asia/Taipei` with `yyyyMMddHHmmss`.
- B2C `buyerName` must not be `0`, `00`, `000`, or `0000`.
- Mobile barcode and love code validation use local format checks because the provided Universal API document does not include remote validation endpoints.
