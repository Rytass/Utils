# Rytass Utils - Payments Adapter CTBC Micro Fast Pay

A comprehensive TypeScript payment adapter for CTBC (Chinatrust Bank) Micro Fast Pay system. This adapter provides seamless integration with Taiwan's CTBC Bank payment gateway, supporting credit card payments, card binding, virtual accounts, and comprehensive payment lifecycle management with built-in server support.

## Features

- [x] CTBC Micro Fast Pay credit card payment integration
- [x] Card binding and tokenization with transaction-based binding
- [x] Bound card checkout functionality
- [x] Built-in HTTP server with automatic callback handling
- [x] Multiple payment channels (Credit Card, Virtual Account, CVS, Barcode, Apple Pay)
- [x] Credit card installment payments
- [x] Transaction query and status tracking
- [x] Order lifecycle management with event-driven architecture
- [x] Secure MAC/TXN signature verification
- [x] Ngrok integration for local development
- [x] LRU cache support for orders and bind card requests
- [x] Custom server integration support
- [x] TypeScript type safety throughout
- [x] Comprehensive error handling and logging
- [x] Production and development environment support

## Installation

```bash
npm install @rytass/payments-adapter-ctbc-micro-fast-pay
# or
yarn add @rytass/payments-adapter-ctbc-micro-fast-pay
```

**Peer Dependencies:**

```bash
npm install @rytass/payments
# Optional: For local development with ngrok
npm install @ngrok/ngrok
```

## Configuration

### Basic Configuration

```typescript
import { CTBCPayment, CTBCOrderState } from '@rytass/payments-adapter-ctbc-micro-fast-pay';
import { PaymentEvents } from '@rytass/payments';

// Production configuration
const productionGateway = new CTBCPayment({
  merchantId: 'YOUR_CTBC_MERCHANT_ID', // CTBC provided merchant ID
  merId: 'YOUR_MER_ID', // Merchant identifier
  txnKey: 'YOUR_TXN_KEY', // MAC/TXN signature key
  terminalId: 'YOUR_TERMINAL_ID', // Terminal identifier
  baseUrl: 'https://ccapi.ctbcbank.com', // Production API URL
  withServer: true, // Enable built-in server
  serverHost: 'https://your-domain.com', // Your callback server
  orderCacheTTL: 1800000, // Order cache TTL (30 minutes)
  bindCardRequestsCacheTTL: 3600000, // Bind card cache TTL (1 hour)
});

// Development configuration
const developmentGateway = new CTBCPayment({
  merchantId: 'TEST_MERCHANT_ID',
  merId: 'TEST_MER_ID',
  txnKey: 'TEST_TXN_KEY',
  terminalId: 'TEST_TERMINAL_ID',
  baseUrl: 'https://test-ccapi.ctbcbank.com', // Test API URL
  withServer: 'ngrok', // Use ngrok for local development
  orderCacheTTL: 600000, // Shorter TTL for testing (10 minutes)
});
```

### Environment-Based Configuration

```typescript
// Secure environment-based setup
const paymentGateway = new CTBCPayment({
  merchantId: process.env.CTBC_MERCHANT_ID!,
  merId: process.env.CTBC_MER_ID!,
  txnKey: process.env.CTBC_TXN_KEY!,
  terminalId: process.env.CTBC_TERMINAL_ID!,
  baseUrl: process.env.NODE_ENV === 'production' ? 'https://ccapi.ctbcbank.com' : 'https://test-ccapi.ctbcbank.com',
  withServer: true,
  serverHost: process.env.SERVER_HOST || 'http://localhost:3000',
  checkoutPath: '/payments/ctbc/checkout',
  callbackPath: '/payments/ctbc/callback',
  bindCardPath: '/payments/ctbc/bind-card',
  boundCardPath: '/payments/ctbc/bound-card',
  orderCacheTTL: parseInt(process.env.ORDER_CACHE_TTL || '1800000'),
  onServerListen: () => {
    console.log('CTBC payment server ready!');
  },
});
```

## Basic Usage

### Simple Credit Card Payment

**Note**: Please use NAT tunnel service (like ngrok) to proxy built-in server if you are behind a LAN network.

```typescript
import { CTBCPayment, CTBCOrderState } from '@rytass/payments-adapter-ctbc-micro-fast-pay';
import { PaymentEvents, Channel } from '@rytass/payments';

const paymentGateway = new CTBCPayment({
  merchantId: 'YOUR_CTBC_MERCHANT_ID',
  merId: 'YOUR_MER_ID',
  txnKey: 'YOUR_TXN_KEY',
  terminalId: 'YOUR_TERMINAL_ID',
  withServer: true,
  serverHost: 'http://localhost:3000',
  onServerListen: () => {
    console.log('CTBC payment server is ready!');
  },
});

// Setup payment event listeners
paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, message => {
  console.log('CTBC payment successful:', message.id);
  console.log('Transaction amount:', message.totalPrice);
  console.log('Platform trade number:', message.platformTradeNumber);
});

// Create order
const order = await paymentGateway.prepare({
  id: 'ORDER-2024-001', // Optional: auto-generated if not provided
  items: [
    {
      name: 'Premium Product',
      unitPrice: 2500,
      quantity: 1,
    },
    {
      name: 'Shipping Fee',
      unitPrice: 100,
      quantity: 1,
    },
  ],
  clientBackUrl: 'https://yoursite.com/payment/return', // Return URL after payment
});

console.log('Order ID:', order.id);
console.log('Total Price:', order.totalPrice);
console.log('Order State:', order.state);

// Three ways to handle checkout:

// 1. Get form data to prepare POST form by yourself
const formData = order.form;
console.log('Form action URL:', 'https://ccapi.ctbcbank.com/PayJSON');
console.log('Form data:', formData);

// 2. Get HTML including form data and automatic submit script
const autoSubmitHTML = order.formHTML;

// 3. Get built-in server URL for auto submit (only works if withServer is set)
const checkoutURL = order.checkoutURL;
console.log('Checkout URL:', checkoutURL);
```

### Credit Card Installment Payment

```typescript
// Create installment payment order
const installmentOrder = await paymentGateway.prepare({
  id: 'INSTALLMENT-ORDER-001',
  items: [
    {
      name: 'High-Value Product',
      unitPrice: 12000,
      quantity: 1,
    },
  ],
  clientBackUrl: 'https://yoursite.com/payment/return',
  installmentCount: 12, // 12 installment periods
  cardType: 'VMJ', // Visa, MasterCard, JCB
});

console.log('Installment order created:', installmentOrder.id);
console.log('Installment periods:', installmentOrder.installmentCount);
```

## Advanced Usage

### Card Binding with Transaction

CTBC Micro Fast Pay allows you to bind cards using successful transactions:

```typescript
import { PaymentEvents } from '@rytass/payments';

const paymentGateway = new CTBCPayment({
  merchantId: 'YOUR_CTBC_MERCHANT_ID',
  merId: 'YOUR_MER_ID',
  txnKey: 'YOUR_TXN_KEY',
  terminalId: 'YOUR_TERMINAL_ID',
  withServer: true,
  requireCacheHit: false, // Allow card binding from transactions
  onCommit: handleOrderCommit,
});

// Handle successful payment and bind card
async function handleOrderCommit(order: CTBCOrder) {
  if (order.state === CTBCOrderState.COMMITTED) {
    const { id, platformTradeNumber } = order;
    const memberId = 'MEMBER_123456';

    try {
      // Prepare card binding request for user
      const bindRequest = await paymentGateway.prepareBindCard(memberId, {
        finishRedirectURL: 'https://your-domain.com/card-bound-success',
      });

      // Save card ID to your database
      const cardId = bindRequest.cardId;
      console.log('Card bound successfully:', cardId);
      console.log('Card prefix:', bindRequest.cardNumberPrefix);
      console.log('Card suffix:', bindRequest.cardNumberSuffix);

      // Store the card information
      await saveCustomerCard({
        memberId,
        cardId,
        cardPrefix: bindRequest.cardNumberPrefix,
        cardSuffix: bindRequest.cardNumberSuffix,
        boundAt: new Date(),
      });
    } catch (error) {
      console.error('Card binding failed:', error.message);
    }
  }
}

// Handle card binding events
paymentGateway.emitter.on(PaymentEvents.CARD_BOUND, bindRequest => {
  console.log(`Card ${bindRequest.cardId} bound for member ${bindRequest.memberId}`);
});

paymentGateway.emitter.on(PaymentEvents.CARD_BINDING_FAILED, bindRequest => {
  console.error('Card binding failed:', bindRequest.failedMessage);

  // Handle card already bound scenario
  if (bindRequest.failedMessage?.code === '10100112') {
    console.log('Card already bound:');
    console.log('Member ID:', bindRequest.memberId);
    console.log('Card ID:', bindRequest.cardId);
    console.log('Card Number Prefix:', bindRequest.cardNumberPrefix);
    console.log('Card Number Suffix:', bindRequest.cardNumberSuffix);
  }
});
```

### Bound Card Checkout

Use previously bound cards for quick checkout:

```typescript
// Checkout with bound card
const boundCardResult = await paymentGateway.checkoutWithBoundCard({
  memberId: 'MEMBER_123456',
  cardId: 'CARD_789012',
  orderId: 'BOUND-ORDER-001',
  items: [
    {
      name: 'Subscription Service',
      unitPrice: 999,
      quantity: 1,
    },
  ],
});

if (boundCardResult.success) {
  console.log('Bound card payment successful:', boundCardResult.orderId);
  console.log('Transaction ID:', boundCardResult.transactionId);
} else {
  console.error('Bound card payment failed:', boundCardResult.error);
}
```

### Transaction Query

```typescript
// Query order status
const orderStatus = await paymentGateway.query('ORDER-2024-001');

console.log('Order ID:', orderStatus.id);
console.log('Order State:', orderStatus.state);
console.log('Total Price:', orderStatus.totalPrice);
console.log('Created At:', orderStatus.createdAt);
console.log('Committed At:', orderStatus.committedAt);

// Check if order is committed
if (orderStatus.state === CTBCOrderState.COMMITTED) {
  console.log('Payment completed successfully');
  console.log('Platform Trade Number:', orderStatus.platformTradeNumber);
} else if (orderStatus.state === CTBCOrderState.FAILED) {
  console.log('Payment failed:', orderStatus.failedMessage);
}
```

### Virtual Account Payment

```typescript
// Create virtual account order
const vatOrder = await paymentGateway.prepare({
  id: 'VAT-ORDER-001',
  channel: Channel.VIRTUAL_ACCOUNT,
  items: [
    {
      name: 'Bulk Purchase',
      unitPrice: 50000,
      quantity: 1,
    },
  ],
  clientBackUrl: 'https://yoursite.com/payment/return',
});

// Listen for async info (virtual account details)
paymentGateway.emitter.on(PaymentEvents.ORDER_INFO_RETRIEVED, order => {
  if (order.asyncInfo?.channel === Channel.VIRTUAL_ACCOUNT) {
    console.log('Virtual Account Details:');
    console.log('Bank Code:', order.asyncInfo.bankCode);
    console.log('Account Number:', order.asyncInfo.account);
    console.log('Expires At:', order.asyncInfo.expiredAt);

    // Send virtual account info to customer
    notifyCustomerVirtualAccount({
      orderId: order.id,
      bankCode: order.asyncInfo.bankCode,
      accountNumber: order.asyncInfo.account,
      amount: order.totalPrice,
      expiresAt: order.asyncInfo.expiredAt,
    });
  }
});
```

### CVS Payment

```typescript
// Create CVS payment order
const cvsOrder = await paymentGateway.prepare({
  id: 'CVS-ORDER-001',
  channel: Channel.CVS_KIOSK,
  items: [
    {
      name: 'Online Purchase',
      unitPrice: 1500,
      quantity: 1,
    },
  ],
  clientBackUrl: 'https://yoursite.com/payment/return',
});

// Listen for CVS payment code
paymentGateway.emitter.on(PaymentEvents.ORDER_INFO_RETRIEVED, order => {
  if (order.asyncInfo?.channel === Channel.CVS_KIOSK) {
    console.log('CVS Payment Details:');
    console.log('Payment Code:', order.asyncInfo.paymentCode);
    console.log('Expires At:', order.asyncInfo.expiredAt);

    // Send CVS payment code to customer
    notifyCustomerCVSCode({
      orderId: order.id,
      paymentCode: order.asyncInfo.paymentCode,
      amount: order.totalPrice,
      expiresAt: order.asyncInfo.expiredAt,
    });
  }
});
```

## Integration Examples

### Express.js API Integration

```typescript
import express from 'express';
import { CTBCPayment, CTBCOrderState } from '@rytass/payments-adapter-ctbc-micro-fast-pay';
import { PaymentEvents, Channel } from '@rytass/payments';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const paymentGateway = new CTBCPayment({
  merchantId: process.env.CTBC_MERCHANT_ID!,
  merId: process.env.CTBC_MER_ID!,
  txnKey: process.env.CTBC_TXN_KEY!,
  terminalId: process.env.CTBC_TERMINAL_ID!,
  withServer: false, // Use custom Express server
  baseUrl: process.env.NODE_ENV === 'production' ? 'https://ccapi.ctbcbank.com' : 'https://test-ccapi.ctbcbank.com',
});

// Use the default server listener for payment handling
app.use(paymentGateway.defaultServerListener);

// Setup payment event handlers
paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, async message => {
  try {
    // Update database
    await updateOrderStatus(message.id, 'paid');

    // Send confirmation email
    await sendPaymentConfirmation(message.id);

    console.log(`CTBC payment committed: ${message.id}`);
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
});

// Create payment endpoint
app.post('/api/payments/ctbc/create', async (req, res) => {
  try {
    const { items, orderId, returnUrl, channel, memberId } = req.body;

    const order = await paymentGateway.prepare({
      id: orderId,
      items: items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
      })),
      clientBackUrl: returnUrl,
      checkoutMemberId: memberId, // For potential card binding
    });

    res.json({
      success: true,
      payment: {
        orderId: order.id,
        totalAmount: order.totalPrice,
        checkoutUrl: order.checkoutURL,
        formData: order.form,
        formHTML: order.formHTML,
        state: order.state,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Query payment status endpoint
app.get('/api/payments/ctbc/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await paymentGateway.query(orderId);

    res.json({
      success: true,
      payment: {
        orderId: order.id,
        state: order.state,
        totalAmount: order.totalPrice,
        createdAt: order.createdAt,
        committedAt: order.committedAt,
        platformTradeNumber: order.platformTradeNumber,
        isCommitted: order.state === CTBCOrderState.COMMITTED,
        isFailed: order.state === CTBCOrderState.FAILED,
      },
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Payment not found',
    });
  }
});

// Bind card endpoint
app.post('/api/payments/ctbc/bind-card', async (req, res) => {
  try {
    const { memberId } = req.body;

    const bindRequest = await paymentGateway.prepareBindCard(memberId, {
      finishRedirectURL: 'https://your-domain.com/card-bound-success',
    });

    res.json({
      success: true,
      cardBinding: {
        cardId: bindRequest.cardId,
        memberId: bindRequest.memberId,
        cardPrefix: bindRequest.cardNumberPrefix,
        cardSuffix: bindRequest.cardNumberSuffix,
        state: bindRequest.state,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Bound card checkout endpoint
app.post('/api/payments/ctbc/bound-card-checkout', async (req, res) => {
  try {
    const { memberId, cardId, items, orderId } = req.body;

    const result = await paymentGateway.checkoutWithBoundCard({
      memberId,
      cardId,
      orderId,
      items: items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
      })),
    });

    if (result.success) {
      res.json({
        success: true,
        payment: {
          orderId: result.orderId,
          transactionId: result.transactionId,
          amount: result.amount,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(3000, () => {
  console.log('CTBC payment server running on port 3000');
});
```

### NestJS Service Integration

```typescript
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { CTBCPayment, CTBCOrderState, CTBCBindCardRequestState } from '@rytass/payments-adapter-ctbc-micro-fast-pay';
import { PaymentEvents, Channel } from '@rytass/payments';

@Injectable()
export class CTBCPaymentService {
  private readonly logger = new Logger(CTBCPaymentService.name);
  private readonly paymentGateway: CTBCPayment;

  constructor() {
    this.paymentGateway = new CTBCPayment({
      merchantId: process.env.CTBC_MERCHANT_ID!,
      merId: process.env.CTBC_MER_ID!,
      txnKey: process.env.CTBC_TXN_KEY!,
      terminalId: process.env.CTBC_TERMINAL_ID!,
      baseUrl: process.env.NODE_ENV === 'production' ? 'https://ccapi.ctbcbank.com' : 'https://test-ccapi.ctbcbank.com',
      withServer: true,
      serverHost: process.env.SERVER_HOST,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, message => {
      this.logger.log(`CTBC payment committed: ${message.id}`);
      this.handlePaymentSuccess(message);
    });

    this.paymentGateway.emitter.on(PaymentEvents.ORDER_FAILED, failure => {
      this.logger.error(`CTBC payment failed: ${failure.code} - ${failure.message}`);
      this.handlePaymentFailure(failure);
    });

    this.paymentGateway.emitter.on(PaymentEvents.CARD_BOUND, bindRequest => {
      this.logger.log(`Card bound: ${bindRequest.cardId} for member ${bindRequest.memberId}`);
      this.handleCardBound(bindRequest);
    });
  }

  async createPayment(paymentData: {
    orderId?: string;
    items: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
    returnUrl?: string;
    memberId?: string;
    channel?: string;
    installmentCount?: number;
  }) {
    const order = await this.paymentGateway.prepare({
      id: paymentData.orderId,
      items: paymentData.items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
      })),
      clientBackUrl: paymentData.returnUrl,
      checkoutMemberId: paymentData.memberId,
      installmentCount: paymentData.installmentCount,
    });

    return {
      orderId: order.id,
      totalAmount: order.totalPrice,
      checkoutUrl: order.checkoutURL,
      formData: order.form,
      state: order.state,
      createdAt: order.createdAt,
    };
  }

  async getPaymentStatus(orderId: string) {
    try {
      const order = await this.paymentGateway.query(orderId);

      return {
        orderId: order.id,
        state: order.state,
        totalAmount: order.totalPrice,
        createdAt: order.createdAt,
        committedAt: order.committedAt,
        platformTradeNumber: order.platformTradeNumber,
        isCommitted: order.state === CTBCOrderState.COMMITTED,
        isFailed: order.state === CTBCOrderState.FAILED,
        failedMessage: order.failedMessage,
      };
    } catch (error) {
      throw new NotFoundException(`Payment ${orderId} not found`);
    }
  }

  async bindCard(memberId: string) {
    try {
      const bindRequest = await this.paymentGateway.prepareBindCard(memberId, {
        finishRedirectURL: 'https://your-domain.com/card-bound-success',
      });

      return {
        cardId: bindRequest.cardId,
        memberId: bindRequest.memberId,
        cardPrefix: bindRequest.cardNumberPrefix,
        cardSuffix: bindRequest.cardNumberSuffix,
        state: bindRequest.state,
        isSuccessful: bindRequest.state === CTBCBindCardRequestState.BOUND,
      };
    } catch (error) {
      throw new BadRequestException(`Card binding failed: ${error.message}`);
    }
  }

  async checkoutWithBoundCard(checkoutData: {
    memberId: string;
    cardId: string;
    orderId?: string;
    items: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
  }) {
    const result = await this.paymentGateway.checkoutWithBoundCard({
      memberId: checkoutData.memberId,
      cardId: checkoutData.cardId,
      orderId: checkoutData.orderId,
      items: checkoutData.items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
      })),
    });

    if (!result.success) {
      throw new BadRequestException(`Bound card checkout failed: ${result.error}`);
    }

    return {
      orderId: result.orderId,
      transactionId: result.transactionId,
      amount: result.amount,
      success: result.success,
    };
  }

  private async handlePaymentSuccess(message: any) {
    // Handle successful payment - update database, send notifications, etc.
    this.logger.log(`Processing payment success for order: ${message.id}`);
  }

  private async handlePaymentFailure(failure: any) {
    // Handle payment failure - log, notify customer, etc.
    this.logger.error(`Processing payment failure: ${failure.code} - ${failure.message}`);
  }

  private async handleCardBound(bindRequest: any) {
    // Handle successful card binding - save to database, etc.
    this.logger.log(`Processing card binding for member: ${bindRequest.memberId}`);
  }
}
```

### React Payment Component

```typescript
import React, { useState, useEffect } from 'react';

interface CTBCPaymentProps {
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  memberId?: string;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
}

const CTBCPayment: React.FC<CTBCPaymentProps> = ({
  items,
  memberId,
  onSuccess,
  onError
}) => {
  const [paymentData, setPaymentData] = useState<any>(null);
  const [boundCards, setBoundCards] = useState<any[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'new' | 'bound'>('new');

  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  useEffect(() => {
    if (memberId) {
      fetchBoundCards();
    }
  }, [memberId]);

  const fetchBoundCards = async () => {
    try {
      const response = await fetch(`/api/members/${memberId}/bound-cards`);
      const data = await response.json();

      if (data.success) {
        setBoundCards(data.cards);
      }
    } catch (error) {
      console.error('Failed to fetch bound cards:', error);
    }
  };

  const createNewPayment = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/payments/ctbc/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          memberId,
          returnUrl: `${window.location.origin}/payment/return`
        })
      });

      const data = await response.json();

      if (data.success) {
        setPaymentData(data.payment);
      } else {
        onError(data.error);
      }
    } catch (error) {
      onError('Payment creation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const checkoutWithBoundCard = async () => {
    if (!selectedCardId) {
      onError('Please select a bound card');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/payments/ctbc/bound-card-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          cardId: selectedCardId,
          items
        })
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(data.payment);
      } else {
        onError(data.error);
      }
    } catch (error) {
      onError('Bound card checkout failed');
    } finally {
      setIsLoading(false);
    }
  };

  const proceedToPayment = () => {
    if (paymentData) {
      // Option 1: Redirect to CTBC hosted checkout
      if (paymentData.checkoutUrl) {
        window.location.href = paymentData.checkoutUrl;
      } else {
        // Option 2: Submit form programmatically
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = 'https://ccapi.ctbcbank.com/PayJSON';

        Object.entries(paymentData.formData).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value as string;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      }
    }
  };

  return (
    <div className="ctbc-payment">
      <h3>CTBC Bank Payment</h3>

      <div className="order-summary">
        <h4>Order Summary</h4>
        {items.map((item, index) => (
          <div key={index} className="item">
            <span>{item.name}</span>
            <span>{item.quantity} x NT${item.price}</span>
          </div>
        ))}
        <div className="total">
          <strong>Total: NT${totalAmount}</strong>
        </div>
      </div>

      {memberId && boundCards.length > 0 && (
        <div className="payment-method-selection">
          <h4>Payment Method</h4>
          <div className="method-options">
            <label>
              <input
                type="radio"
                value="new"
                checked={paymentMethod === 'new'}
                onChange={(e) => setPaymentMethod(e.target.value as 'new' | 'bound')}
              />
              New Credit Card
            </label>
            <label>
              <input
                type="radio"
                value="bound"
                checked={paymentMethod === 'bound'}
                onChange={(e) => setPaymentMethod(e.target.value as 'new' | 'bound')}
              />
              Use Bound Card
            </label>
          </div>
        </div>
      )}

      {paymentMethod === 'bound' && boundCards.length > 0 && (
        <div className="bound-cards">
          <h4>Select Bound Card</h4>
          {boundCards.map((card) => (
            <div key={card.cardId} className="bound-card">
              <label>
                <input
                  type="radio"
                  value={card.cardId}
                  checked={selectedCardId === card.cardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                />
                **** **** **** {card.cardSuffix} ({card.cardType})
              </label>
            </div>
          ))}
        </div>
      )}

      <div className="payment-actions">
        {paymentMethod === 'new' && (
          <>
            {!paymentData && (
              <button
                onClick={createNewPayment}
                disabled={isLoading}
                className="create-payment-btn"
              >
                {isLoading ? 'Creating Payment...' : 'Proceed to Payment'}
              </button>
            )}

            {paymentData && (
              <div className="payment-ready">
                <p>Payment ready for NT${paymentData.totalAmount}</p>
                <button onClick={proceedToPayment} className="pay-btn">
                  Pay with CTBC Bank
                </button>
              </div>
            )}
          </>
        )}

        {paymentMethod === 'bound' && (
          <button
            onClick={checkoutWithBoundCard}
            disabled={!selectedCardId || isLoading}
            className="bound-pay-btn"
          >
            {isLoading ? 'Processing...' : 'Pay with Bound Card'}
          </button>
        )}
      </div>
    </div>
  );
};

export default CTBCPayment;
```

## Error Handling

### Common Error Scenarios

```typescript
try {
  const order = await paymentGateway.prepare({
    items: [
      {
        name: 'Product',
        unitPrice: 1000,
        quantity: 1,
      },
    ],
  });
} catch (error) {
  // Handle different types of errors
  if (error.message.includes('merchantId is required')) {
    console.error('Missing merchant configuration');
  } else if (error.message.includes('Invalid TXN key')) {
    console.error('TXN signature key is invalid');
  } else if (error.message.includes('Server not started')) {
    console.error('Payment server not initialized');
  } else if (error.message.includes('Order cache miss')) {
    console.error('Order not found in cache - may have expired');
  } else {
    console.error('Order preparation failed:', error.message);
  }
}

// Card binding errors
try {
  const bindRequest = await paymentGateway.prepareBindCard('MEMBER_123', {
    finishRedirectURL: 'https://your-domain.com/card-bound-success',
  });
} catch (error) {
  if (error.message.includes('Card already bound')) {
    console.error('This card is already bound to the member');
  } else if (error.message.includes('Invalid transaction')) {
    console.error('Transaction not found or not successful');
  } else if (error.message.includes('Binding timeout')) {
    console.error('Card binding request timed out');
  } else {
    console.error('Card binding failed:', error.message);
  }
}

// Payment event error handling
paymentGateway.emitter.on(PaymentEvents.ORDER_FAILED, failure => {
  switch (failure.code) {
    case 'INVALID_CARD':
      console.error('Credit card information is invalid');
      break;
    case 'INSUFFICIENT_FUNDS':
      console.error('Insufficient funds on card');
      break;
    case 'EXPIRED_CARD':
      console.error('Credit card has expired');
      break;
    case 'DECLINED':
      console.error('Transaction declined by bank');
      break;
    case 'NETWORK_ERROR':
      console.error('Network connection error');
      break;
    default:
      console.error(`Payment failed: ${failure.code} - ${failure.message}`);
  }
});
```

### Validation and Security

```typescript
// Validate MAC/TXN signatures
const validateTransactionSecurity = (transactionData: any) => {
  // CTBC uses MAC/TXN for transaction verification
  // The adapter handles this internally, but you can add additional validation

  if (!transactionData.platformTradeNumber) {
    throw new Error('Missing platform trade number');
  }

  if (!transactionData.amount || transactionData.amount <= 0) {
    throw new Error('Invalid transaction amount');
  }

  return true;
};

// Safe order processing with validation
const processOrderSafely = async (orderData: any) => {
  try {
    // Validate inputs
    if (!orderData.items || orderData.items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    const totalAmount = orderData.items.reduce((sum, item) => {
      return sum + item.unitPrice * item.quantity;
    }, 0);

    if (totalAmount <= 0) {
      throw new Error('Order total must be greater than 0');
    }

    // Create order
    const order = await paymentGateway.prepare(orderData);

    // Log for audit
    console.log(`Order created: ${order.id}, Amount: ${order.totalPrice}`);

    return { success: true, order };
  } catch (error) {
    console.error('Order processing failed:', error);
    return { success: false, error: error.message };
  }
};
```

## Best Practices

### Configuration Management

- Store sensitive credentials (merchantId, txnKey) in environment variables
- Use different merchant IDs for development and production
- Implement proper HTTPS for all payment-related endpoints
- Regularly rotate TXN keys and credentials

### Order Management

- Always validate transaction authenticity using MAC/TXN verification
- Implement appropriate cache TTL for orders and bind card requests
- Use unique order IDs to prevent duplicate transactions
- Log all payment events for debugging and auditing

### Card Binding

- Only bind cards from successful transactions
- Implement proper member authentication before card binding
- Handle "card already bound" scenarios gracefully
- Store card information securely with encryption

### Security

- Validate all payment callbacks before processing
- Implement proper CSRF protection for payment forms
- Use HTTPS for all payment-related communications
- Never log sensitive payment data (card numbers, TXN keys)

### Performance

- Use appropriate cache TTL values based on your use case
- Implement proper connection pooling for database operations
- Monitor payment gateway response times
- Set appropriate timeout values for payment operations

### Error Handling

- Implement comprehensive error logging
- Provide clear error messages to customers
- Handle network failures gracefully with retry mechanisms
- Monitor for unusual payment failure patterns

## Testing

```typescript
import { CTBCPayment, CTBCOrderState, CTBCBindCardRequestState } from '@rytass/payments-adapter-ctbc-micro-fast-pay';
import { Channel } from '@rytass/payments';

describe('CTBC Payment Integration', () => {
  let paymentGateway: CTBCPayment;

  beforeEach(() => {
    paymentGateway = new CTBCPayment({
      merchantId: 'TEST_MERCHANT',
      merId: 'TEST_MER_ID',
      txnKey: 'TEST_TXN_KEY',
      terminalId: 'TEST_TERMINAL',
      baseUrl: 'https://test-ccapi.ctbcbank.com',
    });
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
    });

    expect(order.id).toBeDefined();
    expect(order.totalPrice).toBe(1000);
    expect(order.state).toBe(CTBCOrderState.INITED);
  });

  it('should generate correct form data', async () => {
    const order = await paymentGateway.prepare({
      items: [
        {
          name: 'Test Product',
          unitPrice: 2000,
          quantity: 2,
        },
      ],
    });

    const form = order.form;

    expect(form.merID).toBe('TEST_MER_ID');
    expect(form.URLEnc).toBeDefined();
    expect(form.URLEnc).toContain('TEST_MERCHANT');
  });

  it('should query order status', async () => {
    const order = await paymentGateway.query('TEST-ORDER-001');

    expect(order.id).toBe('TEST-ORDER-001');
    expect(order.state).toBeDefined();
  });

  it('should handle card binding', async () => {
    const bindRequest = await paymentGateway.prepareBindCard('TEST_MEMBER', {
      finishRedirectURL: 'https://test-domain.com/card-bound-success',
    });

    expect(bindRequest.memberId).toBe('TEST_MEMBER');
    expect(bindRequest.cardId).toBeDefined();
    expect(bindRequest.state).toBe(CTBCBindCardRequestState.REQUESTED);
  });

  it('should checkout with bound card', async () => {
    const result = await paymentGateway.checkoutWithBoundCard({
      memberId: 'TEST_MEMBER',
      cardId: 'TEST_CARD_ID',
      orderId: 'BOUND_ORDER_001',
      items: [
        {
          name: 'Test Product',
          unitPrice: 500,
          quantity: 1,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.orderId).toBe('BOUND_ORDER_001');
    expect(result.amount).toBe(500);
  });
});
```

## API Reference

### CTBCPayment Constructor Options

```typescript
interface CTBCPaymentOptions {
  merchantId: string; // Required: CTBC merchant ID
  merchantName?: string; // Optional: Merchant name
  merId: string; // Required: Merchant identifier
  txnKey: string; // Required: MAC/TXN signature key
  terminalId: string; // Required: Terminal identifier

  baseUrl?: string; // Optional: CTBC API URL
  requireCacheHit?: boolean; // Optional: Require cache hit for operations
  withServer?: boolean | 'ngrok'; // Optional: Enable built-in server
  serverHost?: string; // Optional: Server host URL
  checkoutPath?: string; // Optional: Checkout endpoint path
  callbackPath?: string; // Optional: Callback endpoint path
  bindCardPath?: string; // Optional: Card binding path
  orderCacheTTL?: number; // Optional: Order cache TTL in ms
  bindCardRequestsCacheTTL?: number; // Optional: Bind card cache TTL in ms
  onServerListen?: () => void; // Optional: Server ready callback
  onCommit?: (order: CTBCOrder) => void; // Optional: Payment success callback
}
```

### CTBCPayment Methods

#### `prepare(options: PrepareOrderInput): Promise<CTBCOrder>`

Creates a new CTBC payment order.

#### `query(orderId: string): Promise<CTBCOrder>`

Queries payment status by order ID.

#### `prepareBindCard(memberId: string, options?: CTBCRequestPrepareBindCardOptions): Promise<CTBCBindCardRequest>`

Prepares a card binding request for a member.

#### `checkoutWithBoundCard(options: CheckoutWithBoundCardOptions): Promise<BoundCardCheckoutResult>`

Processes payment using a previously bound card.

### Constants and Enums

```typescript
// Order states
enum CTBCOrderState {
  INITED = 'INITED', // Order created
  PRE_COMMIT = 'PRE_COMMIT', // Order submitted to CTBC
  COMMITTED = 'COMMITTED', // Payment successful
  FAILED = 'FAILED', // Payment failed
}

// Card binding states
enum CTBCBindCardRequestState {
  REQUESTED = 'REQUESTED', // Binding requested
  BOUND = 'BOUND', // Card successfully bound
  FAILED = 'FAILED', // Binding failed
}
```

## License

MIT

```

```
