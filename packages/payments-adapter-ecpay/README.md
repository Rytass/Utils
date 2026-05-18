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
- [x] Ticket Issue (ECTicket)
- [x] Query Ticket Issue Result
- [x] Query Ticket Order Info

## Getting Started

### Credit Card Payment

**NOTICE:** Please use NAT tunnel service (like ngrok) to proxy built-in server if you are behind a LAN network.

```typescript
import { Channel, ECPayChannelCreditCard, ECPayPayment } from '@rytass/payments-adapter-ecpay';

// Use built-in server
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
  serverHost: 'http://localhost:3000', // Built-in server listens on localhost:3000 or ngrok url
  onCommit: onOrderCommit,
  withServer: true,
});

// Order ID can be auto-assigned or provided from `id` argument
const order = payment.prepare({
  channel: Channel.CREDIT_CARD,
  items: [
    {
      name: 'Book',
      unitPrice: 200,
      quantity: 1,
    },
    {
      name: '鉛筆',
      unitPrice: 15,
      quantity: 2,
    },
  ],
});

// You have three ways to pre-commit order

// 1. Get form data to prepare POST form by yourself
const form = order.form;

// 2. Get HTML including form data and automatic submit script
const html = order.formHTML;

// 3. Get built-in server URL to auto-submit (only works if `withServer` is set)
const url = order.checkoutURL;
```

### Bind Card With Transaction

```typescript
const payment = new ECPayPayment<ECPayChannelCreditCard>({
  merchantId: MERCHANT_ID,
  hashKey: HASH_KEY,
  hashIv: HASH_IV,
  serverHost: 'http://localhost:3000', // Built-in server listens on localhost:3000 or ngrok url
  onCommit: onOrderCommit,
  withServer: false,
  // when memory is true, you cannot use this transaction to bind card
  memory: false,
});

// get the platform
function onOrderCommit(order: ECPayOrder<ECPayChannelCreditCard>) {
  // When order committed, you can bind card with transaction
  if (ecpayOrder.state !== OrderState.COMMITTED) {
    const { id, platformTradeNumber } = order;
    const memberId = 'MEMBER_ID';
    const request = await ecPayPayment.bindCardWithTransaction(memberId, platformTradeNumber, id);

    // You can save cardId to database
    const cardId = request.cardId;

    // You can use cardId to checkout with bound card
    const result = await this.ecPayPayment.checkoutWithBoundCard({
      memberId,
      cardId,
      description: 'test',
      amount: 100,
    });
  }
}
```

### Handle Card Already Bound

```typescript
const payment = new ECPayPayment();

payment.emitter.on(PaymentEvents.CARD_BINDING_FAILED, (request: ECPayBindCardRequest) => {
  // Card already bound
  if (request.failedMessage?.code === '10100112') {
    console.log(`memberId: ${request.memberId}`);
    console.log(`cardId: ${request.cardId}`);
    console.log(`cardNumberPrefix: ${request.cardNumberPrefix}`);
    console.log(`cardNumberSuffix: ${request.cardNumberSuffix}`);
  }
});
```

## ECTicket (票券) APIs

`ECPayTicketGateway` is an independent gateway for the ECPay ECTicket product line (issuing, querying, refund/redeem notifications for redemption and gift tickets). It uses a different base URL (`ecticket.ecpay.com.tw`) and wire format (AES-128-CBC encrypted JSON envelope with a `CheckMacValue`) than `ECPayPayment`, so it is exposed as a separate class. It shares the same HashKey / HashIV credentials with the payment gateway.

### Setup

```typescript
import {
  ECPayTicketGateway,
  ECPayTicketBaseUrls,
  ECPayTicketEvents,
  ECPayIssueType,
  ECPayPrintType,
  ECPayIsImmediate,
} from '@rytass/payments-adapter-ecpay';

const ticket = new ECPayTicketGateway({
  merchantId: process.env.ECPAY_MERCHANT_ID!,
  hashKey: process.env.ECPAY_HASH_KEY!,
  hashIv: process.env.ECPAY_HASH_IV!,
  baseUrl: ECPayTicketBaseUrls.PRODUCTION, // omit for staging

  // Optional: built-in callback server for RefundNotifyURL / UseStatusNotifyURL
  withServer: true,
  serverHost: 'https://your-domain.com',

  // Optional: tune background polling for issuance result
  issuePoll: {
    intervalMs: 30_000, // default 30s
    timeoutMs: 6 * 60_000, // default 6min (ECPay claims completion within 5min)
  },
});

ticket.emitter.on(ECPayTicketEvents.SERVER_LISTENED, ({ url }) => {
  console.log('Ticket callback server ready at', url);
});
```

### Issue Tickets

After ECPay receives the issue request, the actual issuance is processed asynchronously (typically within 5 minutes). Two usage modes are supported:

**Mode A — return receipt immediately, listen for the final result via events:**

```typescript
ticket.emitter.on(ECPayTicketEvents.TICKET_ISSUED, outcome => {
  // outcome: { status: 'success', merchantTradeNo, freeTradeNo? }
  console.log('Issued:', outcome.merchantTradeNo);
});

ticket.emitter.on(ECPayTicketEvents.TICKET_ISSUE_FAILED, outcome => {
  // outcome: { status: 'failed', merchantTradeNo, remark }
  console.error('Issue failed:', outcome.remark);
});

const receipt = await ticket.issue({
  merchantTradeNo: 'ORDER-2026-0001',
  issueType: ECPayIssueType.PAPER, // CVS / PAPER / ELECTRONIC / SERIAL_ONLY
  printType: ECPayPrintType.ECPAY, // required when issueType is PAPER
  operator: 'system',
  customer: {
    name: '王小明',
    phone: '0912345678',
    email: 'buyer@example.com',
  },
  tickets: [
    { itemNo: 'I1', itemName: '咖啡兌換券', ticketPrice: 150, ticketAmount: 10 },
  ],
});

console.log(receipt.ticketTradeNo); // ECPay-assigned trade number
```

**Mode B — await final outcome (`waitForIssuance: true`):**

```typescript
const outcome = await ticket.issue({
  merchantTradeNo: 'ORDER-2026-0002',
  issueType: ECPayIssueType.ELECTRONIC,
  isImmediate: ECPayIsImmediate.IMMEDIATE,
  operator: 'system',
  customer: { name: '王小明', phone: '0912345678', email: 'a@b.com' },
  tickets: [{ itemNo: 'I1', ticketAmount: 1 }],
  waitForIssuance: true,
});

if (outcome.status === 'success') {
  // proceed with fulfilment
} else if (outcome.status === 'failed') {
  console.error(outcome.remark);
}
```

### Query Issue Result (manual)

```typescript
const outcome = await ticket.queryIssueResult({ merchantTradeNo: 'ORDER-2026-0001' });

switch (outcome.status) {
  case 'success':
    // tickets are ready
    break;
  case 'processing':
    // still in queue
    break;
  case 'failed':
    console.error(outcome.remark);
    break;
}
```

### Query Order Info (with ticket list)

```typescript
const info = await ticket.queryOrderInfo({
  merchantTradeNo: 'ORDER-2026-0001',
  pageNum: 1, // optional, 200 tickets per page
});

console.log(info.totalCount, info.tradeAmount);
console.log(info.redeemCount, info.refundCount, info.unUsedCount);

info.tickets.forEach(t => {
  console.log(t.ticketNo, t.useStatus); // 'unused' | 'redeemed' | 'refunded' | 'expired'
});
```

### Refund / Use-status Notifications

When `withServer: true`, the gateway mounts two callback endpoints and emits events whenever ECPay pushes a notification. Pass the notify URLs to `issue()` either explicitly via `refundNotifyUrl` / `useStatusNotifyUrl`, or let the gateway auto-fill them from `serverHost`.

```typescript
ticket.emitter.on(ECPayTicketEvents.TICKET_REFUND_NOTIFIED, notification => {
  console.log('Refunded:', notification.ticketTradeNo, notification.refundAmount);
});

ticket.emitter.on(ECPayTicketEvents.TICKET_USE_STATUS_CHANGED, notification => {
  console.log('Use status changed:', notification.ticketNo, notification.useStatus);
});
```

Default callback paths (overridable via `refundNotifyPath` / `useStatusNotifyPath` options):

- `POST /payments/ecpay/ticket/refund`
- `POST /payments/ecpay/ticket/use-status`

Each callback is verified against its `CheckMacValue` before the event fires; invalid envelopes are rejected with `400 0|InvalidCheckMacValue` and do not emit.
