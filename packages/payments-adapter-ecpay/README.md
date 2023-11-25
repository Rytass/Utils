# Rytass Utils - Payments (ECPay)

## Features

- [x] Built-in callback server
- [x] Checkout (Credit Card)
- [x] Checkout (Credit Card Installments)
- [ ] Checkout (WebATM)
- [x] Checkout (ATM/Virtual Account)
- [x] Checkout (CVS)
- [x] Checkout (Barcode)
- [x] Checkout (Apple Pay)
- [ ] Checkout (Line Pay)
- [x] Query
- [ ] Refund
- [ ] Refund (Installments)
- [x] Card Binding

## Getting Started

### Credit Card Payment

**NOTICE** Please use NAT tunnel service (like ngrok) to proxy built-in server if you behind a LAN network.

```typescript
import { Channel, ECPayChannelCreditCard, ECPayPayment } from '@rytass/payments-adapter-ecpay';

// Use bulit-in server
const MERCHANT_ID = 'YOUR_ECPAY_MERCHANT_ID';
const HASH_KEY = 'YOUR_ECPAY_HASH_KEY';
const HASH_IV = 'YOUR_ECPAY_HASH_IV';

function onOrderCommit(order: ECPayOrder<ECPayChannelCreditCard>) {
  // When order committed, you can check amount, transaction code....
}

const payment = new ECPayPayment<ECPayChannelCreditCard>({
  merchantId: MERCHANT_ID,
  hashKey: HASH_KEY,
  hashIv: HASH_IV,
  serverHost: 'http://localhost:3000', // Built in server listen on localhost:3000 or ngrok url
  onCommit: onOrderCommit,
  withServer: true,
});

// Order id can auto assign or provide from `id` argument
const order = payment.prepare({
  channel: Channel.CREDIT_CARD,
  items: [{
    name: 'Book',
    unitPrice: 200,
    quantity: 1,
  }, {
    name: '鉛筆',
    unitPrice: 15,
    quantity: 2,
  }],
});

// You have three ways to pre-commit order

// 1. Get form data to prepare POST form by yourself
const form = order.form;

// 2. Get HTML including form data and automatic submit script
const html = order.formHTML;

// 3. Get built-in server URL to auto submit (only works if `withServer` is set)
const url = order.checkoutURL;
```
