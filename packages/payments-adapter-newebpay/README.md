# Rytass Utils - NewebPay Payment Adapter

Comprehensive payment adapter for NewebPay (formerly MPG - Multi Payment Gateway), Taiwan's leading payment service provider. Offers unified payment processing with support for credit cards, virtual accounts, WebATM, and mobile payment solutions including Android Pay and Samsung Pay.

## Features

- [x] Credit Card payments (with installments)
- [x] Android Pay integration
- [x] Samsung Pay integration
- [x] UnionPay card processing
- [x] WebATM bank transfers
- [x] Virtual Account generation
- [x] Card binding and tokenization
- [x] Built-in callback server
- [x] Multi-language UI support (Traditional Chinese, English, Japanese)
- [x] Trade limit and expiration controls
- [x] Order query and status tracking
- [x] Refund processing
- [x] Installment payment plans

## Installation

```bash
npm install @rytass/payments-adapter-newebpay
# or
yarn add @rytass/payments-adapter-newebpay
```

## Basic Usage

### Credit Card Payment

```typescript
import { 
  NewebPayPayment, 
  NewebPaymentChannel 
} from '@rytass/payments-adapter-newebpay';
import { Channel } from '@rytass/payments';

const payment = new NewebPayPayment({
  merchantId: 'YOUR_NEWEBPAY_MERCHANT_ID',
  hashKey: 'YOUR_NEWEBPAY_HASH_KEY',
  hashIv: 'YOUR_NEWEBPAY_HASH_IV',
  serverHost: 'https://your-domain.com',
  withServer: true,
  onCommit: (order) => {
    console.log('Payment committed:', order);
    // Handle successful payment
  }
});

// Create credit card order
const order = payment.prepare({
  channel: Channel.CREDIT_CARD,
  items: [
    {
      name: 'Premium Product',
      unitPrice: 1500,
      quantity: 1
    },
    {
      name: 'Shipping Fee',
      unitPrice: 100,
      quantity: 1
    }
  ],
  language: 'zh-tw',
  email: 'customer@example.com'
});

// Get checkout URL
const checkoutUrl = order.checkoutURL;
```

### Virtual Account Payment

```typescript
import { NewebPayVirtualAccountBank } from '@rytass/payments-adapter-newebpay';

const order = payment.prepare({
  channel: Channel.VIRTUAL_ACCOUNT,
  items: [{
    name: 'Monthly Subscription',
    unitPrice: 999,
    quantity: 1
  }],
  // Specify preferred bank
  additionalInfo: {
    bankType: NewebPayVirtualAccountBank.BOT
  },
  // Set payment expiration (days)
  tradeLimit: 3,
  email: 'customer@example.com'
});

// Virtual account info will be available after order creation
console.log('Virtual Account Number:', order.paymentInfo.account);
console.log('Bank Code:', order.paymentInfo.bankCode);
```

### WebATM Payment

```typescript
import { NewebPayWebATMBank } from '@rytass/payments-adapter-newebpay';

const order = payment.prepare({
  channel: Channel.WEB_ATM,
  items: [{
    name: 'Digital Course',
    unitPrice: 2500,
    quantity: 1
  }],
  additionalInfo: {
    bankType: NewebPayWebATMBank.TAISHIN
  }
});
```

## Payment Channels

### Supported Channels

| Channel | Description | Channel Code |
|---------|-------------|--------------|
| `CREDIT` | Credit Card | `1` |
| `ANDROID_PAY` | Android Pay | `2` |
| `SAMSUNG_PAY` | Samsung Pay | `4` |
| `UNION_PAY` | UnionPay Cards | `8` |
| `WEBATM` | WebATM Transfer | `16` |
| `VACC` | Virtual Account | `32` |

### Multi-Channel Payment

```typescript
// Accept multiple payment methods
const order = payment.prepare({
  channel: NewebPaymentChannel.CREDIT | 
           NewebPaymentChannel.ANDROID_PAY | 
           NewebPaymentChannel.VACC,
  items: [{
    name: 'Flexible Payment Product',
    unitPrice: 999,
    quantity: 1
  }]
});
```

## Card Binding and Tokenization

### Bind Card for Future Payments

```typescript
const payment = new NewebPayPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  hashKey: 'YOUR_HASH_KEY',
  hashIv: 'YOUR_HASH_IV',
  serverHost: 'https://your-domain.com',
  memory: false, // Required for card binding
});

// Prepare a card binding request
const bindRequest = await payment.prepareBindCard({
  memberId: 'user123',
  description: '綁定信用卡',
  finishRedirectURL: 'https://your-site.com/card-bound-success'
});

// Get the binding URL for user to complete card binding
console.log('Card binding URL:', bindRequest.checkoutURL);

// Handle card binding completion (usually in callback)
payment.emitter.on(PaymentEvents.CARD_BINDING_SUCCESS, (request) => {
  console.log('Card bound successfully:', request.cardId);
  console.log('Member ID:', request.memberId);
  
  // Store card token for future use
  saveCardToken(request.cardId, request.memberId);
});
```

### Checkout with Bound Card

```typescript
// Use previously bound card for payment
const boundCardPayment = await payment.checkoutWithBoundCard({
  memberId: 'user123',
  cardId: 'saved-card-token',
  description: 'Subscription Renewal',
  amount: 999
});

console.log('Payment Result:', boundCardPayment.status);
```

### Handle Card Binding Events

```typescript
import { PaymentEvents } from '@rytass/payments';

payment.emitter.on(PaymentEvents.CARD_BINDING_FAILED, (request) => {
  if (request.failedMessage?.code === '10100112') {
    // Card already bound
    console.log('Card already exists for member:', request.memberId);
    console.log('Existing Card ID:', request.cardId);
  }
});
```

## Credit Card Installments

```typescript
import { NewebPayCreditCardInstallmentOptions } from '@rytass/payments-adapter-newebpay';

const installmentOrder = payment.prepare({
  channel: Channel.CREDIT_CARD,
  items: [{
    name: 'High-value Product',
    unitPrice: 12000,
    quantity: 1
  }],
  additionalInfo: {
    installment: NewebPayCreditCardInstallmentOptions.SIX_MONTHS
  }
});
```

### Available Installment Options

- `THREE_MONTHS` - 3 期分期
- `SIX_MONTHS` - 6 期分期
- `TWELVE_MONTHS` - 12 期分期
- `EIGHTEEN_MONTHS` - 18 期分期
- `TWENTY_FOUR_MONTHS` - 24 期分期

## Configuration Options

### NewebPayPaymentInitOptions

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `merchantId` | `string` | Yes | - | NewebPay Merchant ID |
| `hashKey` | `string` | Yes | - | API Hash Key |
| `hashIv` | `string` | Yes | - | API Hash IV |
| `serverHost` | `string` | No | `localhost:3000` | Callback server host |
| `withServer` | `boolean` | No | `false` | Enable built-in callback server |
| `memory` | `boolean` | No | `true` | Use in-memory order storage |
| `onCommit` | `function` | No | - | Order commit callback |
| `onFailed` | `function` | No | - | Payment failure callback |

## Order Management

### Query Payment Status

```typescript
// Query order by ID
const orderStatus = await payment.query('ORDER_ID_123');

console.log('Order Status:', orderStatus.state);
console.log('Payment Method:', orderStatus.paymentMethod);
console.log('Amount:', orderStatus.totalPrice);
```

### Handle Payment Notifications

```typescript
// Built-in server automatically handles notifications
const payment = new NewebPayPayment({
  // ... config
  withServer: true,
  onCommit: (order) => {
    // Order successfully paid
    console.log(`Order ${order.id} committed`);
    console.log(`Amount: NT$${order.totalPrice}`);
    console.log(`Platform Trade Number: ${order.platformTradeNumber}`);
  },
  onFailed: (order, error) => {
    // Payment failed
    console.log(`Order ${order.id} failed:`, error);
  }
});
```

## Multi-Language Support

```typescript
import { AllowUILanguage } from '@rytass/payments-adapter-newebpay';

const order = payment.prepare({
  channel: Channel.CREDIT_CARD,
  items: [/* items */],
  language: AllowUILanguage.EN, // English UI
  // Available: ZH_TW, EN, JP
});
```

## Advanced Features

### Custom Trade Limits

```typescript
const order = payment.prepare({
  channel: Channel.VIRTUAL_ACCOUNT,
  items: [/* items */],
  tradeLimit: 7, // Payment expires in 7 days
  expireDate: '2024-12-31', // Or specific date
});
```

### Custom Return URLs

```typescript
const order = payment.prepare({
  channel: Channel.CREDIT_CARD,
  items: [/* items */],
  clientBackUrl: 'https://yoursite.com/payment-success',
  remark: 'Special promotion order'
});
```

## Environment Variables

```bash
# .env
NEWEBPAY_MERCHANT_ID=your_merchant_id
NEWEBPAY_HASH_KEY=your_hash_key
NEWEBPAY_HASH_IV=your_hash_iv
NEWEBPAY_SERVER_HOST=https://your-domain.com
```

```typescript
const payment = new NewebPayPayment({
  merchantId: process.env.NEWEBPAY_MERCHANT_ID!,
  hashKey: process.env.NEWEBPAY_HASH_KEY!,
  hashIv: process.env.NEWEBPAY_HASH_IV!,
  serverHost: process.env.NEWEBPAY_SERVER_HOST!,
  withServer: true
});
```

## Error Handling

```typescript
import { OrderState } from '@rytass/payments';

try {
  const order = payment.prepare({
    channel: Channel.CREDIT_CARD,
    items: [/* invalid items */]
  });
} catch (error) {
  console.error('Order preparation failed:', error.message);
}

// Handle payment failures
payment.emitter.on('order_failed', (order, error) => {
  console.log(`Order ${order.id} failed:`, error);
  
  // Implement retry logic or user notification
  notifyUser(`Payment failed: ${error.message}`);
});
```

## Testing

### Development Mode

```typescript
// Use NewebPay test environment
const testPayment = new NewebPayPayment({
  merchantId: 'MS350015834', // Test merchant ID
  hashKey: 'Ggo9KBc0JYIQ28ulMOHPOqrJCuPO8Ns8', // Test hash key
  hashIv: 'x9jt40c4oNWdBJn2', // Test hash IV
  serverHost: 'https://your-test-domain.com',
  withServer: true
});
```

### Test Credit Cards

NewebPay provides test credit card numbers:

- **VISA**: `4000-2211-1111-1111`
- **MasterCard**: `5424-1800-0000-0015`
- **JCB**: `3566-0020-2036-0505`

## Production Deployment

### Using ngrok for Development

```bash
# Install ngrok peer dependency
npm install @ngrok/ngrok

# Start your local server
npm start

# In another terminal, expose to internet
npx ngrok http 3000
```

```typescript
const payment = new NewebPayPayment({
  merchantId: process.env.NEWEBPAY_MERCHANT_ID!,
  hashKey: process.env.NEWEBPAY_HASH_KEY!,
  hashIv: process.env.NEWEBPAY_HASH_IV!,
  serverHost: 'https://abcd1234.ngrok.io', // ngrok URL
  withServer: true
});
```

## Integration with NestJS

```typescript
// Use with @rytass/payments-nestjs-module
import { PaymentsModule } from '@rytass/payments-nestjs-module';
import { NewebPayPayment } from '@rytass/payments-adapter-newebpay';

@Module({
  imports: [
    PaymentsModule.forRoot({
      gateway: new NewebPayPayment({
        merchantId: process.env.NEWEBPAY_MERCHANT_ID!,
        hashKey: process.env.NEWEBPAY_HASH_KEY!,
        hashIv: process.env.NEWEBPAY_HASH_IV!,
        serverHost: process.env.SERVER_HOST!,
        withServer: true
      })
    })
  ]
})
export class AppModule {}
```

## Best Practices

### Security
- Store credentials in environment variables
- Use HTTPS for production callback URLs  
- Implement proper webhook signature validation
- Log payment events for audit trails

### Performance
- Enable memory caching for frequent order queries
- Implement connection pooling for database operations
- Use appropriate trade limits to prevent expired orders

### User Experience
- Provide clear payment method options
- Display accurate payment fees and processing times
- Implement proper error messages in user's language
- Offer payment retry mechanisms

## License

MIT