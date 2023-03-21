# `@rytass/payments-adapter-hwanan`

## Usage

### A. With Build-in Server, it creating a server for checking out and receiving callback information
```typescript
import { HwaNanPayment } from '@rytass/payments-adapter-hwanan';

const MERCHANT_ID = 'MERCHANT_ID';
const TERMINAL_ID = 'TERMINAL_ID';
const MER_ID = 'MER_ID';
const IDENTIFIER = 'IDENTIFIER';

const payment = new HwaNanPayment({
  merchantId: MERCHANT_ID,
  terminalId: TERMINAL_ID,
  merID: MER_ID,
  merchantName: 'Rytass Shop',
  identifier: IDENTIFIER,
  withServer: true,
  checkoutPath: '/payments/hwanan/checkout',
  callbackPath: '/payments/hwanan/callback',
  serverHost: 'http://url.to.com',
  onServerListen: () => {
    const order = payment.prepare({
      items: [{
        name: 'Pencil',
        unitPrice: 10,
        quantity: 2,
      }],
    });

    // 1. You can provide form fields with submit url
    const formPostAction = payment.checkoutActionUrl; // {API_HOST}/transaction/api-auth/
    const form = order.form; // Key-value for form post

    // 2. Get generated auto submit form HTML
    const formHTML = order.formHTML; // <!DOCTYPE html>....

    // 3. Get checkout url. It will auto serve checkout form page
    const checkoutURL = `http://url.to.com/payments/hwanan/checkout/${order.id}`;
  },
});
```

### B. If you wanna use server created by yourself, this library providing a default server listener for you.

```typescript
import express from 'express';
import { HwaNanPayment } from '@rytass/payments-adapter-hwanan';

const MERCHANT_ID = 'MERCHANT_ID';
const TERMINAL_ID = 'TERMINAL_ID';
const MER_ID = 'MER_ID';
const IDENTIFIER = 'IDENTIFIER';

const payment = new HwaNanPayment({
  merchantId: MERCHANT_ID,
  terminalId: TERMINAL_ID,
  merID: MER_ID,
  merchantName: 'Rytass Shop',
  identifier: IDENTIFIER,
  checkoutPath: '/payments/hwanan/checkout',
  callbackPath: '/payments/hwanan/callback',
});

// e.g. express
const app = express();

// server will listen GET checkoutPath and POST callbackPath
app.use(payment.defaultServerListener);
```

### C. You can also parse callback by yourself

```typescript
import { Channel } from '@rytass/payments';
import { HwaNanPayment, HwaNanPaymentChannel } from '@rytass/payments-adapter-hwanan';

const MERCHANT_ID = 'MERCHANT_ID';
const TERMINAL_ID = 'TERMINAL_ID';
const MER_ID = 'MER_ID';
const IDENTIFIER = 'IDENTIFIER';

const payment = new HwaNanPayment({
  merchantId: MERCHANT_ID,
  terminalId: TERMINAL_ID,
  merID: MER_ID,
  merchantName: 'Rytass Shop',
  identifier: IDENTIFIER,
});

const order = payment.prepare({
  items: [{
    name: 'Pencil',
    unitPrice: 10,
    quantity: 2,
  }],
});

order.state // OrderState.INITED or OrderState.PRE_COMMIT

// Somewhere receive the callback
order.commit({
  id: 'ORDER_ID',
  totalPrice: 10,
  committedAt: new Date(),
  channel: HwaNanPaymentChannel.CREDIT,
  platformTradeNumber: 'xid',
}, {
  channel: Channel.CREDIT_CARD,
  processDate: new Date(),
  authCode: '000000',
  amount: 10,
  eci: '',
  card6Number: 'xxxxxx',
  card4Number: '1234',
});

order.state // OrderState.COMMITTED
```
