# Rytass Utils - Payments

A comprehensive TypeScript payment framework designed for Taiwan's payment ecosystem. Provides a unified interface for payment processing across multiple providers with support for various payment methods, card binding, and subscription payments.

## Features

- [x] Unified payment interface across multiple providers
- [x] Multiple payment channel support (Credit Card, WebATM, Virtual Account, CVS)
- [x] Card binding and tokenization support
- [x] Subscription and recurring payment management
- [x] Real-time payment status tracking
- [x] Event-driven architecture with EventEmitter
- [x] TypeScript type safety throughout
- [x] Order lifecycle management
- [x] Refund and reversal operations
- [x] Payment method detection and routing
- [x] Extensible adapter pattern architecture

## Available Adapters

This package provides the core interfaces and types. Use with specific adapter implementations:

- **[@rytass/payments-adapter-ecpay](https://www.npmjs.com/package/@rytass/payments-adapter-ecpay)** - ECPay payment integration
- **[@rytass/payments-adapter-newebpay](https://www.npmjs.com/package/@rytass/payments-adapter-newebpay)** - NewebPay payment integration
- **[@rytass/payments-adapter-hwanan](https://www.npmjs.com/package/@rytass/payments-adapter-hwanan)** - HwaNan Bank payment integration
- **[@rytass/payments-adapter-happy-card](https://www.npmjs.com/package/@rytass/payments-adapter-happy-card)** - Happy Card payment integration
- **[@rytass/payments-adapter-icash-pay](https://www.npmjs.com/package/@rytass/payments-adapter-icash-pay)** - iCash Pay integration
- **[@rytass/payments-adapter-ctbc-micro-fast-pay](https://www.npmjs.com/package/@rytass/payments-adapter-ctbc-micro-fast-pay)** - CTBC Micro Fast Pay integration
- **[@rytass/payments-nestjs-module](https://www.npmjs.com/package/@rytass/payments-nestjs-module)** - NestJS integration module

## Installation

```bash
npm install @rytass/payments
# Install a specific adapter
npm install @rytass/payments-adapter-ecpay
# or
yarn add @rytass/payments @rytass/payments-adapter-ecpay
```

## Basic Usage

### Payment Gateway Implementation

```typescript
import { PaymentGateway, PaymentItem, Channel } from '@rytass/payments';
import { ECPayPaymentGateway } from '@rytass/payments-adapter-ecpay';

// Initialize payment gateway
const paymentGateway = new ECPayPaymentGateway({
  merchantId: 'YOUR_MERCHANT_ID',
  hashKey: 'YOUR_HASH_KEY',
  hashIV: 'YOUR_HASH_IV',
  isProduction: false,
});

// Prepare an order
const order = await paymentGateway.prepare({
  items: [
    {
      name: 'Product A',
      unitPrice: 1000,
      quantity: 2,
    },
    {
      name: 'Product B',
      unitPrice: 500,
      quantity: 1,
    },
  ],
  id: 'ORDER-2024-001',
  clientBackUrl: 'https://yoursite.com/payment/return',
});

console.log('Order ID:', order.id);
console.log('Order State:', order.state);
console.log(
  'Total Price:',
  order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
);
```

### Credit Card Payment

```typescript
// Listen for payment events
paymentGateway.emitter.on('ORDER_COMMITTED', message => {
  console.log('Payment successful:', message);
  console.log('Card Type:', message.cardType);
  console.log('Committed At:', message.committedAt);
});

// Prepare credit card order
const creditCardOrder = await paymentGateway.prepare({
  items: [
    {
      name: 'Premium Service',
      unitPrice: 2000,
      quantity: 1,
    },
  ],
  id: 'CC-ORDER-001',
});

// The order will be committed automatically when payment is completed
// through the payment provider's interface
```

### Virtual Account Payment

```typescript
// Prepare virtual account order
const vatOrder = await paymentGateway.prepare({
  items: [
    {
      name: 'Bulk Purchase',
      unitPrice: 10000,
      quantity: 1,
    },
  ],
  id: 'VAT-ORDER-001',
});

// Listen for async info retrieval
paymentGateway.emitter.on('ORDER_INFO_RETRIEVED', order => {
  if (order.asyncInfo?.channel === Channel.VIRTUAL_ACCOUNT) {
    console.log('Bank Code:', order.asyncInfo.bankCode);
    console.log('Account Number:', order.asyncInfo.account);
    console.log('Expires At:', order.asyncInfo.expiredAt);
  }
});
```

### CVS Payment

```typescript
// Prepare CVS payment order
const cvsOrder = await paymentGateway.prepare({
  items: [
    {
      name: 'Online Purchase',
      unitPrice: 800,
      quantity: 1,
    },
  ],
  id: 'CVS-ORDER-001',
});

// Listen for CVS payment code
paymentGateway.emitter.on('ORDER_INFO_RETRIEVED', order => {
  if (order.asyncInfo?.channel === Channel.CVS_KIOSK) {
    console.log('Payment Code:', order.asyncInfo.paymentCode);
    console.log('Expires At:', order.asyncInfo.expiredAt);
    // Display payment code to customer
  }
});
```

## Core Concepts

### Payment Channels

The framework supports multiple payment channels:

```typescript
import { Channel } from '@rytass/payments';

// Available payment channels
Channel.CREDIT_CARD; // Credit/Debit card payments
Channel.WEB_ATM; // Online ATM transfers
Channel.VIRTUAL_ACCOUNT; // Virtual account transfers
Channel.CVS_KIOSK; // CVS kiosk payments
Channel.CVS_BARCODE; // CVS barcode payments
Channel.APPLE_PAY; // Apple Pay payments
Channel.LINE_PAY; // LINE Pay payments
```

### Order Lifecycle

```typescript
import { OrderState } from '@rytass/payments';

// Order states throughout the payment process
OrderState.INITED; // Order initialized
OrderState.PRE_COMMIT; // Order created at gateway
OrderState.ASYNC_INFO_RETRIEVED; // Payment info retrieved (for async payments)
OrderState.COMMITTED; // Payment completed successfully
OrderState.FAILED; // Payment failed
OrderState.REFUNDED; // Payment refunded
```

### Payment Items

```typescript
import { PaymentItem } from '@rytass/payments';

const items: PaymentItem[] = [
  {
    name: 'Product Name',
    unitPrice: 1000, // Price per unit in cents or smallest currency unit
    quantity: 2, // Number of items
  },
];
```

## Advanced Usage

### Card Binding and Tokenization

```typescript
import { BindCardPaymentGateway, BindCardRequest } from '@rytass/payments';

// For gateways that support card binding
const bindingGateway = paymentGateway as BindCardPaymentGateway;

// Prepare card binding
const bindRequest = await bindingGateway.prepareBindCard('member-123');

// Listen for binding events
paymentGateway.emitter.on('CARD_BOUND', bindingInfo => {
  console.log('Card bound successfully:', bindingInfo.cardId);
});

// Use bound card for payment
const boundCardOrder = await bindingGateway.checkoutWithBoundCard({
  cardId: 'bound-card-id',
  memberId: 'member-123',
  orderId: 'BOUND-ORDER-001',
  items: [
    {
      name: 'Subscription Service',
      unitPrice: 2999,
      quantity: 1,
    },
  ],
});
```

### Event Handling

```typescript
import { PaymentEvents } from '@rytass/payments';

// Listen to all payment events
paymentGateway.emitter.on(PaymentEvents.ORDER_PRE_COMMIT, order => {
  console.log('Order created:', order.id);
});

paymentGateway.emitter.on(PaymentEvents.ORDER_INFO_RETRIEVED, order => {
  console.log('Payment info retrieved for:', order.id);
  // Handle async payment information (VAT, CVS, etc.)
});

paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, message => {
  console.log('Payment committed:', message.id);
  console.log('Amount:', message.totalPrice);
  console.log('Committed at:', message.committedAt);
});

paymentGateway.emitter.on(PaymentEvents.ORDER_FAILED, failure => {
  console.error('Payment failed:', failure.code, failure.message);
});
```

### Order Querying

```typescript
// Query order status
const existingOrder = await paymentGateway.query('ORDER-2024-001');

console.log('Order State:', existingOrder.state);
console.log('Created At:', existingOrder.createdAt);
console.log('Committed At:', existingOrder.committedAt);

// Check additional payment info
if (existingOrder.additionalInfo) {
  switch (existingOrder.additionalInfo.channel) {
    case Channel.CREDIT_CARD:
      console.log('Auth Code:', existingOrder.additionalInfo.authCode);
      console.log('Card Number:', existingOrder.additionalInfo.card4Number);
      break;
    case Channel.WEB_ATM:
      console.log('Bank Code:', existingOrder.additionalInfo.buyerBankCode);
      console.log('Account:', existingOrder.additionalInfo.buyerAccountNumber);
      break;
  }
}
```

### Refund Operations

```typescript
// Full refund
await order.refund();

// Partial refund
await order.refund(500); // Refund 500 units

// Refund with options (gateway-specific)
await order.refund(1000, {
  reason: 'Customer requested',
  refundId: 'REFUND-001',
});
```

## TypeScript Integration

### Custom Payment Items

```typescript
import { PaymentItem, PrepareOrderInput } from '@rytass/payments';

// Extend base PaymentItem with custom properties
interface CustomPaymentItem extends PaymentItem {
  productId: string;
  category: string;
  discount?: number;
  taxRate?: number;
}

// Use with payment gateway
const customOrder = await paymentGateway.prepare({
  items: [
    {
      name: 'Premium Product',
      unitPrice: 2000,
      quantity: 1,
      productId: 'PROD-001',
      category: 'Electronics',
      discount: 200,
      taxRate: 0.05,
    },
  ] as CustomPaymentItem[],
  id: 'CUSTOM-ORDER-001',
});
```

### Generic Payment Gateway

```typescript
import { PaymentGateway, Order, OrderCommitMessage } from '@rytass/payments';

// Type-safe payment service
class PaymentService<CM extends OrderCommitMessage> {
  constructor(private gateway: PaymentGateway<CM>) {}

  async processPayment(items: PaymentItem[], orderId: string): Promise<Order<CM>> {
    return this.gateway.prepare({ items, id: orderId });
  }

  async checkPaymentStatus(orderId: string): Promise<Order<CM>> {
    return this.gateway.query(orderId);
  }
}
```

## Integration Examples

### Express.js API Integration

```typescript
import express from 'express';
import { ECPayPaymentGateway } from '@rytass/payments-adapter-ecpay';
import { PaymentEvents, Channel } from '@rytass/payments';

const app = express();
const paymentGateway = new ECPayPaymentGateway({
  merchantId: process.env.ECPAY_MERCHANT_ID!,
  hashKey: process.env.ECPAY_HASH_KEY!,
  hashIV: process.env.ECPAY_HASH_IV!,
  isProduction: process.env.NODE_ENV === 'production',
});

// Setup payment event handlers
paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, async message => {
  // Handle successful payment
  await updateOrderStatus(message.id, 'paid');
  await sendConfirmationEmail(message.id);
});

// Create payment endpoint
app.post('/api/payments/create', async (req, res) => {
  try {
    const { items, orderId, paymentMethod, returnUrl } = req.body;

    const order = await paymentGateway.prepare({
      items,
      id: orderId,
      clientBackUrl: returnUrl,
    });

    res.json({
      success: true,
      orderId: order.id,
      paymentUrl: order.checkoutUrl, // Gateway-specific checkout URL
      state: order.state,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Query payment status endpoint
app.get('/api/payments/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await paymentGateway.query(orderId);

    res.json({
      success: true,
      order: {
        id: order.id,
        state: order.state,
        createdAt: order.createdAt,
        committedAt: order.committedAt,
        totalAmount: order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      },
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Order not found',
    });
  }
});

// Payment callback endpoint (for async payments)
app.post('/api/payments/callback', async (req, res) => {
  try {
    // Handle payment gateway callback
    // This is typically handled by the specific adapter
    res.status(200).send('OK');
  } catch (error) {
    res.status(400).send('ERROR');
  }
});
```

### NestJS Service Integration

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PaymentGateway, PaymentEvents, OrderState, Channel } from '@rytass/payments';
import { ECPayPaymentGateway } from '@rytass/payments-adapter-ecpay';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly paymentGateway: PaymentGateway;

  constructor() {
    this.paymentGateway = new ECPayPaymentGateway({
      merchantId: process.env.ECPAY_MERCHANT_ID!,
      hashKey: process.env.ECPAY_HASH_KEY!,
      hashIV: process.env.ECPAY_HASH_IV!,
      isProduction: process.env.NODE_ENV === 'production',
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, message => {
      this.logger.log(`Payment committed: ${message.id}`);
      this.handlePaymentSuccess(message);
    });

    this.paymentGateway.emitter.on(PaymentEvents.ORDER_FAILED, failure => {
      this.logger.error(`Payment failed: ${failure.code} - ${failure.message}`);
      this.handlePaymentFailure(failure);
    });

    this.paymentGateway.emitter.on(PaymentEvents.ORDER_INFO_RETRIEVED, order => {
      this.logger.log(`Payment info retrieved: ${order.id}`);
      this.handleAsyncPaymentInfo(order);
    });
  }

  async createPayment(paymentData: {
    items: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
    orderId: string;
    returnUrl?: string;
  }) {
    const order = await this.paymentGateway.prepare({
      items: paymentData.items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
      })),
      id: paymentData.orderId,
      clientBackUrl: paymentData.returnUrl,
    });

    return {
      orderId: order.id,
      state: order.state,
      paymentUrl: order.checkoutUrl,
      totalAmount: order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    };
  }

  async getPaymentStatus(orderId: string) {
    const order = await this.paymentGateway.query(orderId);

    return {
      orderId: order.id,
      state: order.state,
      createdAt: order.createdAt,
      committedAt: order.committedAt,
      failedMessage: order.failedMessage,
      additionalInfo: order.additionalInfo,
    };
  }

  async refundPayment(orderId: string, amount?: number) {
    const order = await this.paymentGateway.query(orderId);

    if (order.state !== OrderState.COMMITTED) {
      throw new Error('Can only refund committed payments');
    }

    await order.refund(amount);

    return {
      orderId: order.id,
      state: order.state,
      refundAmount: amount,
    };
  }

  private async handlePaymentSuccess(message: any) {
    // Update database, send notifications, etc.
  }

  private async handlePaymentFailure(failure: any) {
    // Log failure, notify customer, etc.
  }

  private async handleAsyncPaymentInfo(order: any) {
    // Handle virtual account, CVS payment codes, etc.
    if (order.asyncInfo?.channel === Channel.VIRTUAL_ACCOUNT) {
      // Send virtual account info to customer
    } else if (order.asyncInfo?.channel === Channel.CVS_KIOSK) {
      // Send CVS payment code to customer
    }
  }
}
```

### React Payment Integration

```typescript
import React, { useState, useEffect } from 'react';
import { PaymentItem, OrderState, Channel } from '@rytass/payments';

interface PaymentProps {
  items: PaymentItem[];
  orderId: string;
  onSuccess: (orderId: string) => void;
  onError: (error: string) => void;
}

const PaymentComponent: React.FC<PaymentProps> = ({
  items,
  orderId,
  onSuccess,
  onError
}) => {
  const [paymentState, setPaymentState] = useState<OrderState | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  const createPayment = async () => {
    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          orderId,
          returnUrl: `${window.location.origin}/payment/return`
        })
      });

      const data = await response.json();

      if (data.success) {
        setPaymentState(data.state);

        // Redirect to payment gateway for credit card payments
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        }
      } else {
        onError(data.error);
      }
    } catch (error) {
      onError('Payment creation failed');
    }
  };

  const checkPaymentStatus = async () => {
    try {
      const response = await fetch(`/api/payments/${orderId}/status`);
      const data = await response.json();

      if (data.success) {
        setPaymentState(data.order.state);

        if (data.order.state === OrderState.COMMITTED) {
          onSuccess(orderId);
        } else if (data.order.state === OrderState.FAILED) {
          onError('Payment failed');
        }
      }
    } catch (error) {
      onError('Status check failed');
    }
  };

  useEffect(() => {
    // Poll payment status for async payments
    if (paymentState === OrderState.ASYNC_INFO_RETRIEVED) {
      const interval = setInterval(checkPaymentStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [paymentState]);

  const totalAmount = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  return (
    <div className="payment-component">
      <h3>Payment Summary</h3>
      <div className="items">
        {items.map((item, index) => (
          <div key={index} className="item">
            <span>{item.name}</span>
            <span>{item.quantity} x ${item.unitPrice}</span>
          </div>
        ))}
      </div>
      <div className="total">
        Total: ${totalAmount}
      </div>

      {!paymentState && (
        <button onClick={createPayment}>
          Proceed to Payment
        </button>
      )}

      {paymentState === OrderState.ASYNC_INFO_RETRIEVED && (
        <div className="async-payment-info">
          <p>Please complete payment using the provided information</p>
          {/* Display virtual account, CVS code, etc. */}
        </div>
      )}

      {paymentState === OrderState.COMMITTED && (
        <div className="success">
          Payment completed successfully!
        </div>
      )}
    </div>
  );
};

export default PaymentComponent;
```

## Best Practices

### Security

- Store sensitive credentials in environment variables
- Validate all payment callbacks and webhooks
- Implement proper HTTPS for all payment-related endpoints
- Use CSRF protection for payment forms

### Error Handling

- Always listen for payment failure events
- Implement proper timeout handling for async payments
- Provide clear error messages to users
- Log all payment events for debugging and auditing

### Performance

- Cache payment gateway instances when possible
- Implement proper connection pooling for high-volume scenarios
- Use appropriate timeout settings for payment operations
- Monitor payment gateway response times

### State Management

- Track order states throughout the payment lifecycle
- Implement proper cleanup for expired orders
- Handle duplicate payment attempts gracefully
- Maintain audit trails for all payment operations

## Testing

```typescript
import { PaymentGateway, OrderState, Channel } from '@rytass/payments';

describe('Payment Integration', () => {
  let paymentGateway: PaymentGateway;

  beforeEach(() => {
    // Initialize test gateway
    paymentGateway = new TestPaymentGateway();
  });

  it('should create order successfully', async () => {
    const order = await paymentGateway.prepare({
      items: [
        {
          name: 'Test Product',
          unitPrice: 1000,
          quantity: 1,
        },
      ],
      id: 'TEST-ORDER-001',
    });

    expect(order.id).toBe('TEST-ORDER-001');
    expect(order.state).toBe(OrderState.PRE_COMMIT);
  });

  it('should handle payment success', async () => {
    const order = await paymentGateway.prepare({
      items: [{ name: 'Test', unitPrice: 1000, quantity: 1 }],
      id: 'TEST-SUCCESS',
    });

    // Simulate payment success
    order.commit({
      id: 'TEST-SUCCESS',
      totalPrice: 1000,
      committedAt: new Date(),
      type: Channel.CREDIT_CARD,
    });

    expect(order.state).toBe(OrderState.COMMITTED);
    expect(order.committedAt).toBeDefined();
  });

  it('should handle payment failure', async () => {
    const order = await paymentGateway.prepare({
      items: [{ name: 'Test', unitPrice: 1000, quantity: 1 }],
      id: 'TEST-FAILURE',
    });

    order.fail('CARD_DECLINED', 'Credit card was declined');

    expect(order.state).toBe(OrderState.FAILED);
    expect(order.failedMessage?.code).toBe('CARD_DECLINED');
  });
});
```

## License

MIT
