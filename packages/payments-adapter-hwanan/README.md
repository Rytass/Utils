# Rytass Utils - Payments Adapter HwaNan

A comprehensive TypeScript payment adapter for HwaNan Bank's credit card payment gateway. This adapter provides seamless integration with Taiwan's HwaNan Bank payment system, offering multiple integration patterns with built-in server support, custom implementation flexibility, and comprehensive event handling.

## Features

- [x] HwaNan Bank credit card payment integration
- [x] Built-in HTTP server with automatic callback handling
- [x] Custom server integration support
- [x] Manual callback processing capability
- [x] Automatic form generation and submission
- [x] Order lifecycle management with event-driven architecture
- [x] Secure payment verification with checkValue validation
- [x] Ngrok integration for local development
- [x] Customizable page language support (ZH_TW, ZH_CN, EN_US, JA_JP)
- [x] Order caching with LRU cache support
- [x] Transaction type support (one-time and installment)
- [x] Auto-capture and manual capture modes
- [x] TypeScript type safety throughout
- [x] Comprehensive error handling and validation

## Installation

```bash
npm install @rytass/payments-adapter-hwanan
# or
yarn add @rytass/payments-adapter-hwanan
```

**Peer Dependencies:**
```bash
npm install @rytass/payments
# Optional: For local development with ngrok
npm install @ngrok/ngrok
```

## Configuration

### Basic Configuration Options

```typescript
import { HwaNanPayment, HwaNanCustomizePageType } from '@rytass/payments-adapter-hwanan';

const paymentGateway = new HwaNanPayment({
  merchantId: 'YOUR_MERCHANT_ID',        // HwaNan provided merchant ID
  terminalId: 'YOUR_TERMINAL_ID',        // HwaNan provided terminal ID
  merID: 'YOUR_MER_ID',                  // Merchant identifier
  merchantName: 'Your Shop Name',        // Display name for payment page
  identifier: 'YOUR_SECRET_IDENTIFIER',   // Secret key for checkValue generation
  
  // Optional configurations
  baseUrl: 'https://paymentgateway-stage.hwananbank.com.tw', // Default: staging URL
  customizePageType: HwaNanCustomizePageType.ZH_TW,          // Page language
  customizePageVersion: '1.0',                               // Page version
  serverHost: 'https://your-domain.com',                     // Your callback server
  checkoutPath: '/payments/hwanan/checkout',                 // Checkout endpoint path
  callbackPath: '/payments/hwanan/callback',                 // Callback endpoint path
  ttl: 1800000,                                             // Order cache TTL (30 min)
});
```

### Environment-Specific Configuration

```typescript
// Production configuration
const productionGateway = new HwaNanPayment({
  merchantId: process.env.HWANAN_MERCHANT_ID!,
  terminalId: process.env.HWANAN_TERMINAL_ID!,
  merID: process.env.HWANAN_MER_ID!,
  merchantName: process.env.SHOP_NAME!,
  identifier: process.env.HWANAN_IDENTIFIER!,
  baseUrl: 'https://paymentgateway.hwananbank.com.tw', // Production URL
  serverHost: 'https://yoursite.com',
  customizePageType: HwaNanCustomizePageType.EN_US
});

// Development configuration with ngrok
const developmentGateway = new HwaNanPayment({
  merchantId: 'TEST_MERCHANT_ID',
  terminalId: 'TEST_TERMINAL_ID', 
  merID: 'TEST_MER_ID',
  merchantName: 'Test Shop',
  identifier: 'TEST_IDENTIFIER',
  withServer: 'ngrok', // Automatically creates ngrok tunnel
  customizePageType: HwaNanCustomizePageType.ZH_TW
});
```

## Basic Usage

### Built-in Server Integration

The simplest way to integrate HwaNan payments with automatic server creation and callback handling:

```typescript
import { HwaNanPayment, HwaNanPaymentChannel } from '@rytass/payments-adapter-hwanan';
import { PaymentEvents } from '@rytass/payments';

const paymentGateway = new HwaNanPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  terminalId: 'YOUR_TERMINAL_ID',
  merID: 'YOUR_MER_ID',
  merchantName: 'Rytass Shop',
  identifier: 'YOUR_IDENTIFIER',
  withServer: true,                              // Creates built-in server
  serverHost: 'https://your-domain.com',
  checkoutPath: '/payments/hwanan/checkout',
  callbackPath: '/payments/hwanan/callback',
  onServerListen: () => {
    console.log('HwaNan payment server is ready!');
  }
});

// Setup payment event listeners
paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, (message) => {
  console.log('Payment successful:', message.id);
  console.log('Platform Trade Number:', message.platformTradeNumber);
  console.log('Amount:', message.totalPrice);
});

// Prepare an order
const order = await paymentGateway.prepare({
  id: 'ORDER-2024-001', // Optional: auto-generated if not provided
  items: [
    {
      name: 'Premium Product',
      unitPrice: 1500,
      quantity: 2
    },
    {
      name: 'Shipping Fee',
      unitPrice: 100,
      quantity: 1
    }
  ]
});

console.log('Order ID:', order.id);
console.log('Total Amount:', order.totalPrice);

// Three ways to handle checkout:

// 1. Direct form submission data
const formAction = paymentGateway.checkoutActionUrl;
const formData = order.form;

// 2. Auto-generated HTML form
const autoSubmitHTML = order.formHTML;

// 3. Hosted checkout URL
const checkoutURL = `${paymentGateway.serverHost}/payments/hwanan/checkout/${order.id}`;
```

### Express.js Integration

Integrate with your existing Express.js application:

```typescript
import express from 'express';
import { HwaNanPayment } from '@rytass/payments-adapter-hwanan';
import { PaymentEvents } from '@rytass/payments';

const app = express();

const paymentGateway = new HwaNanPayment({
  merchantId: process.env.HWANAN_MERCHANT_ID!,
  terminalId: process.env.HWANAN_TERMINAL_ID!,
  merID: process.env.HWANAN_MER_ID!,
  merchantName: 'Your E-commerce Store',
  identifier: process.env.HWANAN_IDENTIFIER!,
  serverHost: process.env.SERVER_HOST || 'http://localhost:3000',
  checkoutPath: '/payments/hwanan/checkout',
  callbackPath: '/payments/hwanan/callback'
});

// Use the default server listener for payment handling
app.use(paymentGateway.defaultServerListener);

// Setup payment success handling
paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, async (message) => {
  try {
    // Update your database
    await updateOrderStatus(message.id, 'paid');
    
    // Send confirmation email
    await sendOrderConfirmation(message.id);
    
    console.log(`Payment committed for order: ${message.id}`);
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
});

// Create payment endpoint
app.post('/api/create-payment', async (req, res) => {
  try {
    const { items, orderId, customerInfo } = req.body;
    
    const order = await paymentGateway.prepare({
      id: orderId,
      items: items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity
      }))
    });
    
    res.json({
      success: true,
      orderId: order.id,
      checkoutUrl: `${process.env.SERVER_HOST}/payments/hwanan/checkout/${order.id}`,
      totalAmount: order.totalPrice
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Manual Callback Processing

For complete control over payment processing and callback handling:

```typescript
import { Channel, PaymentEvents } from '@rytass/payments';
import { HwaNanPayment, HwaNanPaymentChannel } from '@rytass/payments-adapter-hwanan';

const paymentGateway = new HwaNanPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  terminalId: 'YOUR_TERMINAL_ID',
  merID: 'YOUR_MER_ID', 
  merchantName: 'Custom Integration Shop',
  identifier: 'YOUR_IDENTIFIER'
  // No server configuration - manual handling
});

// Prepare order
const order = await paymentGateway.prepare({
  id: 'MANUAL-ORDER-001',
  items: [
    {
      name: 'Digital Product',
      unitPrice: 2000,
      quantity: 1
    }
  ]
});

console.log('Order State:', order.state); // OrderState.INITED or OrderState.PRE_COMMIT

// Get form data for your custom checkout page
const checkoutData = {
  action: paymentGateway.checkoutActionUrl,
  method: 'POST',
  fields: order.form
};

// Process payment callback manually (in your callback endpoint)
app.post('/custom-hwanan-callback', async (req, res) => {
  try {
    const callbackData = req.body;
    
    // Find the order (implement your own order retrieval logic)
    const order = await findOrderById(callbackData.lidm);
    
    if (callbackData.status === '1') { // Success
      // Commit the order with payment details
      order.commit({
        id: callbackData.lidm,
        totalPrice: parseInt(callbackData.authAmt),
        committedAt: new Date(),
        channel: HwaNanPaymentChannel.CREDIT,
        platformTradeNumber: callbackData.xid
      }, {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: callbackData.authCode,
        amount: parseInt(callbackData.authAmt),
        eci: '', // HwaNan doesn't provide ECI in standard callback
        card4Number: callbackData.Last4digitPAN,
        card6Number: '******'
      });
      
      console.log('Order State:', order.state); // OrderState.COMMITTED
    } else {
      // Handle payment failure
      order.fail(callbackData.errcode, callbackData.errDesc);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Callback processing error:', error);
    res.status(400).send('ERROR');
  }
});
```

## Advanced Usage

### Installment Payments

```typescript
import { HwaNanTransactionType, HwaNanAutoCapMode } from '@rytass/payments-adapter-hwanan';

// Configure gateway for installment payments
const installmentGateway = new HwaNanPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  terminalId: 'YOUR_TERMINAL_ID',
  merID: 'YOUR_MER_ID',
  merchantName: 'Installment Shop',
  identifier: 'YOUR_IDENTIFIER',
  withServer: true
});

// Create installment order
const installmentOrder = await installmentGateway.prepare({
  items: [
    {
      name: 'High-value Product',
      unitPrice: 30000, // NT$30,000
      quantity: 1
    }
  ]
});

// The payment form will include installment options
const installmentForm = installmentOrder.form;
console.log('Installment form data:', installmentForm);
```

### Custom Order Caching

```typescript
import { OrdersCache } from '@rytass/payments-adapter-hwanan';

// Implement custom cache (e.g., Redis)
class RedisOrderCache implements OrdersCache<HwaNanCommitMessage, string, HwaNanOrder<HwaNanCommitMessage>> {
  private redis: RedisClient;
  
  constructor(redisClient: RedisClient) {
    this.redis = redisClient;
  }
  
  async get(key: string): Promise<HwaNanOrder<HwaNanCommitMessage> | undefined> {
    const data = await this.redis.get(`hwanan:order:${key}`);
    return data ? JSON.parse(data) : undefined;
  }
  
  async set(key: string, value: HwaNanOrder<HwaNanCommitMessage>): Promise<void> {
    await this.redis.setex(`hwanan:order:${key}`, 3600, JSON.stringify(value));
  }
}

// Use custom cache
const paymentGateway = new HwaNanPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  terminalId: 'YOUR_TERMINAL_ID',
  merID: 'YOUR_MER_ID',
  merchantName: 'Cached Shop',
  identifier: 'YOUR_IDENTIFIER',
  ordersCache: new RedisOrderCache(redisClient),
  withServer: true
});
```

### Multi-language Support

```typescript
import { HwaNanCustomizePageType } from '@rytass/payments-adapter-hwanan';

// Different language configurations
const configs = {
  traditionalChinese: {
    customizePageType: HwaNanCustomizePageType.ZH_TW,
    merchantName: '繁體中文商店'
  },
  simplifiedChinese: {
    customizePageType: HwaNanCustomizePageType.ZH_CN,
    merchantName: '简体中文商店'
  },
  english: {
    customizePageType: HwaNanCustomizePageType.EN_US,
    merchantName: 'English Store'
  },
  japanese: {
    customizePageType: HwaNanCustomizePageType.JA_JP,
    merchantName: '日本語ストア'
  }
};

// Create gateway with specific language
const createGatewayForLanguage = (language: keyof typeof configs) => {
  return new HwaNanPayment({
    merchantId: 'YOUR_MERCHANT_ID',
    terminalId: 'YOUR_TERMINAL_ID',
    merID: 'YOUR_MER_ID',
    identifier: 'YOUR_IDENTIFIER',
    ...configs[language],
    withServer: true
  });
};

const englishGateway = createGatewayForLanguage('english');
const chineseGateway = createGatewayForLanguage('traditionalChinese');
```

### Order Query and Management

```typescript
// Query order status
const queryOrder = async (orderId: string) => {
  try {
    const order = await paymentGateway.query(orderId);
    
    return {
      id: order.id,
      state: order.state,
      totalPrice: order.totalPrice,
      items: order.items,
      createdAt: order.createdAt,
      committedAt: order.committedAt,
      additionalInfo: order.additionalInfo
    };
  } catch (error) {
    console.error('Order not found:', error);
    return null;
  }
};

// Check order status
const orderStatus = await queryOrder('ORDER-2024-001');
if (orderStatus) {
  console.log('Order found:', orderStatus);
  console.log('Payment completed:', orderStatus.state === 'COMMITTED');
}
```

## Integration Examples

### NestJS Service Integration

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { HwaNanPayment, HwaNanPaymentChannel } from '@rytass/payments-adapter-hwanan';
import { PaymentEvents, OrderState } from '@rytass/payments';

@Injectable()
export class HwaNanPaymentService {
  private readonly logger = new Logger(HwaNanPaymentService.name);
  private readonly paymentGateway: HwaNanPayment;
  
  constructor() {
    this.paymentGateway = new HwaNanPayment({
      merchantId: process.env.HWANAN_MERCHANT_ID!,
      terminalId: process.env.HWANAN_TERMINAL_ID!,
      merID: process.env.HWANAN_MER_ID!,
      merchantName: process.env.SHOP_NAME!,
      identifier: process.env.HWANAN_IDENTIFIER!,
      serverHost: process.env.SERVER_HOST!,
      withServer: true
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, (message) => {
      this.logger.log(`Payment committed: ${message.id}`);
      this.handlePaymentSuccess(message);
    });
    
    this.paymentGateway.emitter.on(PaymentEvents.ORDER_FAILED, (failure) => {
      this.logger.error(`Payment failed: ${failure.code} - ${failure.message}`);
      this.handlePaymentFailure(failure);
    });
  }
  
  async createPayment(orderData: {
    orderId?: string;
    items: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
  }) {
    const order = await this.paymentGateway.prepare({
      id: orderData.orderId,
      items: orderData.items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity
      }))
    });
    
    return {
      orderId: order.id,
      checkoutUrl: `${process.env.SERVER_HOST}/payments/hwanan/checkout/${order.id}`,
      totalAmount: order.totalPrice,
      formAction: this.paymentGateway.checkoutActionUrl,
      formData: order.form,
      autoSubmitHtml: order.formHTML
    };
  }
  
  async getOrderStatus(orderId: string) {
    try {
      const order = await this.paymentGateway.query(orderId);
      
      return {
        orderId: order.id,
        state: order.state,
        totalPrice: order.totalPrice,
        createdAt: order.createdAt,
        committedAt: order.committedAt,
        isPaid: order.state === OrderState.COMMITTED
      };
    } catch (error) {
      throw new Error(`Order ${orderId} not found`);
    }
  }
  
  private async handlePaymentSuccess(message: any) {
    // Update database, send notifications, etc.
    this.logger.log(`Processing payment success for order: ${message.id}`);
  }
  
  private async handlePaymentFailure(failure: any) {
    // Log failure, notify customer, etc.
    this.logger.error(`Processing payment failure: ${failure.code}`);
  }
}
```

### React Payment Component

```typescript
import React, { useState, useEffect } from 'react';
import { OrderState } from '@rytass/payments';

interface HwaNanPaymentProps {
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  orderId?: string;
  onSuccess: (orderId: string) => void;
  onError: (error: string) => void;
}

const HwaNanPayment: React.FC<HwaNanPaymentProps> = ({
  items,
  orderId,
  onSuccess,
  onError
}) => {
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const createPayment = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/payments/hwanan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, orderId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPaymentData(data);
      } else {
        onError(data.error);
      }
    } catch (error) {
      onError('Payment creation failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  const proceedToPayment = () => {
    if (paymentData) {
      // Option 1: Redirect to hosted checkout
      window.location.href = paymentData.checkoutUrl;
      
      // Option 2: Submit form programmatically
      // const form = document.createElement('form');
      // form.method = 'POST';
      // form.action = paymentData.formAction;
      // Object.entries(paymentData.formData).forEach(([key, value]) => {
      //   const input = document.createElement('input');
      //   input.type = 'hidden';
      //   input.name = key;
      //   input.value = value as string;
      //   form.appendChild(input);
      // });
      // document.body.appendChild(form);
      // form.submit();
    }
  };
  
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  return (
    <div className="hwanan-payment">
      <h3>HwaNan Bank Payment</h3>
      
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
      
      {!paymentData && (
        <button 
          onClick={createPayment} 
          disabled={isLoading}
          className="create-payment-btn"
        >
          {isLoading ? 'Creating Payment...' : 'Proceed to Payment'}
        </button>
      )}
      
      {paymentData && (
        <div className="payment-options">
          <p>Payment ready for NT${paymentData.totalAmount}</p>
          <button onClick={proceedToPayment} className="pay-btn">
            Pay with HwaNan Bank
          </button>
        </div>
      )}
    </div>
  );
};

export default HwaNanPayment;
```

### Local Development with Ngrok

```typescript
import { HwaNanPayment } from '@rytass/payments-adapter-hwanan';

// Automatically creates ngrok tunnel for local development
const developmentGateway = new HwaNanPayment({
  merchantId: 'TEST_MERCHANT_ID',
  terminalId: 'TEST_TERMINAL_ID',
  merID: 'TEST_MER_ID',
  merchantName: 'Development Store',
  identifier: 'TEST_IDENTIFIER',
  withServer: 'ngrok', // Creates ngrok tunnel automatically
  onServerListen: () => {
    console.log('Development server ready with ngrok tunnel!');
    console.log('Server host:', developmentGateway.serverHost);
  }
});

// The ngrok tunnel URL will be automatically used for callbacks
const testOrder = await developmentGateway.prepare({
  items: [
    {
      name: 'Test Product',
      unitPrice: 100,
      quantity: 1
    }
  ]
});

console.log('Test checkout URL:', `${developmentGateway.serverHost}/payments/hwanan/checkout/${testOrder.id}`);
```

## Payment Channels

### Supported Payment Methods

```typescript
import { HwaNanPaymentChannel } from '@rytass/payments-adapter-hwanan';

// Currently supported channel
const supportedChannels = {
  CREDIT: HwaNanPaymentChannel.CREDIT // Credit card payments
};

// Future channels (check HwaNan Bank documentation)
// DEBIT: HwaNanPaymentChannel.DEBIT     // Debit card payments
// ATM: HwaNanPaymentChannel.ATM         // ATM transfers
```

### Transaction Types

```typescript
import { HwaNanTransactionType, HwaNanAutoCapMode } from '@rytass/payments-adapter-hwanan';

// One-time payment (default)
const oneTimePayment = HwaNanTransactionType.ONE_TIME;

// Installment payment (requires minimum 3 installments)
const installmentPayment = HwaNanTransactionType.INSTALLMENTS;

// Auto-capture modes
const autoCapture = HwaNanAutoCapMode.AUTO;     // Automatically capture payment
const manualCapture = HwaNanAutoCapMode.MANUALLY; // Manual capture required
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
        quantity: 1
      }
    ]
  });
} catch (error) {
  if (error.message.includes('merchantId is required')) {
    console.error('Missing merchant configuration');
  } else if (error.message.includes('Invalid item data')) {
    console.error('Invalid product information');
  } else if (error.message.includes('Server not started')) {
    console.error('Payment server not initialized');
  } else {
    console.error('Order preparation failed:', error.message);
  }
}

// Handle callback errors
paymentGateway.emitter.on(PaymentEvents.ORDER_FAILED, (failure) => {
  switch (failure.code) {
    case '05': // Do not honor
      console.error('Card declined by issuing bank');
      break;
    case '51': // Insufficient funds
      console.error('Insufficient funds');
      break;
    case '54': // Expired card
      console.error('Card has expired');
      break;
    default:
      console.error(`Payment failed: ${failure.code} - ${failure.message}`);
  }
});
```

### Validation and Security

```typescript
// Validate callback authenticity
const validateCallback = (callbackData: HwaNanNotifyPayload) => {
  const { checkValue, ...dataToValidate } = callbackData;
  
  // HwaNan provides checkValue for validation
  // Implementation depends on your identifier and HwaNan's hashing method
  const calculatedCheckValue = generateCheckValue(dataToValidate);
  
  if (checkValue !== calculatedCheckValue) {
    throw new Error('Invalid callback - checkValue mismatch');
  }
  
  return true;
};

// Safe order processing
const processOrderSafely = async (orderId: string, callbackData: any) => {
  try {
    // Validate callback
    validateCallback(callbackData);
    
    // Get order from cache or database
    const order = await paymentGateway.query(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    if (order.state === OrderState.COMMITTED) {
      console.log('Order already processed');
      return order;
    }
    
    // Process payment
    if (callbackData.status === '1') {
      order.commit({
        id: orderId,
        totalPrice: parseInt(callbackData.authAmt),
        committedAt: new Date(),
        channel: HwaNanPaymentChannel.CREDIT,
        platformTradeNumber: callbackData.xid
      });
    } else {
      order.fail(callbackData.errcode, callbackData.errDesc);
    }
    
    return order;
  } catch (error) {
    console.error('Order processing failed:', error);
    throw error;
  }
};
```

## Best Practices

### Configuration Management
- Store sensitive credentials in environment variables
- Use different merchant IDs for development and production
- Implement proper HTTPS for all payment-related endpoints
- Regularly rotate identifiers and credentials

### Order Management
- Always validate callback authenticity using checkValue
- Implement idempotent payment processing to handle duplicate callbacks
- Use appropriate TTL for order caching
- Log all payment events for debugging and auditing

### Security
- Validate all payment callbacks before processing
- Implement proper CSRF protection for payment forms
- Use HTTPS for all payment-related communications
- Store sensitive payment data securely with proper encryption

### Performance
- Use custom caching solutions (Redis) for high-volume scenarios
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
import { HwaNanPayment, HwaNanPaymentChannel } from '@rytass/payments-adapter-hwanan';
import { OrderState, Channel } from '@rytass/payments';

describe('HwaNan Payment Integration', () => {
  let paymentGateway: HwaNanPayment;
  
  beforeEach(() => {
    paymentGateway = new HwaNanPayment({
      merchantId: 'TEST_MERCHANT',
      terminalId: 'TEST_TERMINAL',
      merID: 'TEST_MER_ID',
      merchantName: 'Test Store',
      identifier: 'TEST_IDENTIFIER'
    });
  });
  
  it('should create order successfully', async () => {
    const order = await paymentGateway.prepare({
      items: [
        {
          name: 'Test Product',
          unitPrice: 1000,
          quantity: 1
        }
      ]
    });
    
    expect(order.id).toBeDefined();
    expect(order.totalPrice).toBe(1000);
    expect(order.state).toBe(OrderState.PRE_COMMIT);
  });
  
  it('should generate correct form data', async () => {
    const order = await paymentGateway.prepare({
      items: [
        {
          name: 'Test Product',
          unitPrice: 2000,
          quantity: 2
        }
      ]
    });
    
    const form = order.form;
    
    expect(form.MerchantID).toBe('TEST_MERCHANT');
    expect(form.TerminalID).toBe('TEST_TERMINAL');
    expect(form.purchAmt).toBe(4000);
    expect(form.lidm).toBe(order.id);
    expect(form.checkValue).toBeDefined();
  });
  
  it('should handle payment success', async () => {
    const order = await paymentGateway.prepare({
      items: [
        {
          name: 'Test Product',
          unitPrice: 1000,
          quantity: 1
        }
      ]
    });
    
    // Simulate successful payment
    order.commit({
      id: order.id,
      totalPrice: 1000,
      committedAt: new Date(),
      channel: HwaNanPaymentChannel.CREDIT,
      platformTradeNumber: 'TEST_XID_123'
    }, {
      channel: Channel.CREDIT_CARD,
      processDate: new Date(),
      authCode: '123456',
      amount: 1000,
      eci: '',
      card4Number: '1234',
      card6Number: '******'
    });
    
    expect(order.state).toBe(OrderState.COMMITTED);
    expect(order.committedAt).toBeDefined();
  });
  
  it('should handle payment failure', async () => {
    const order = await paymentGateway.prepare({
      items: [
        {
          name: 'Test Product',
          unitPrice: 1000,
          quantity: 1
        }
      ]
    });
    
    order.fail('05', 'Do not honor');
    
    expect(order.state).toBe(OrderState.FAILED);
    expect(order.failedMessage?.code).toBe('05');
    expect(order.failedMessage?.message).toBe('Do not honor');
  });
});
```

## API Reference

### HwaNanPayment Constructor Options

```typescript
interface HwaNanPaymentInitOptions {
  merchantId: string;                    // Required: HwaNan merchant ID
  terminalId: string;                    // Required: HwaNan terminal ID  
  merID: string;                         // Required: Merchant identifier
  merchantName: string;                  // Required: Store name for payment page
  identifier: string;                    // Required: Secret for checkValue generation
  
  baseUrl?: string;                      // Optional: HwaNan API URL
  customizePageType?: HwaNanCustomizePageType; // Optional: Page language
  customizePageVersion?: string;         // Optional: Page version
  serverHost?: string;                   // Optional: Your server domain
  checkoutPath?: string;                 // Optional: Checkout endpoint path
  callbackPath?: string;                 // Optional: Callback endpoint path
  withServer?: boolean | 'ngrok';        // Optional: Enable built-in server
  ttl?: number;                         // Optional: Order cache TTL in milliseconds
  ordersCache?: OrdersCache;            // Optional: Custom caching implementation
  onServerListen?: () => void;          // Optional: Server ready callback
  onCommit?: (order: HwaNanOrder) => void; // Optional: Payment success callback
}
```

### HwaNanOrder Methods

```typescript
interface HwaNanOrder {
  id: string;                           // Order ID
  totalPrice: number;                   // Total amount
  items: PaymentItem[];                 // Order items
  state: OrderState;                    // Current order state
  form: Record<string, string>;         // Payment form data
  formHTML: string;                     // Auto-submit form HTML
  
  commit(message: HwaNanCommitMessage, additionalInfo?: CreditCardAuthInfo): void;
  fail(code: string, message: string): void;
}
```

### Constants and Enums

```typescript
// Page language options
enum HwaNanCustomizePageType {
  ZH_TW = 1,  // Traditional Chinese
  ZH_CN = 2,  // Simplified Chinese  
  EN_US = 3,  // English
  JA_JP = 4,  // Japanese
  OTHER = 5   // Other languages
}

// Transaction types
enum HwaNanTransactionType {
  ONE_TIME = 0,      // Single payment
  INSTALLMENTS = 1   // Installment payments (min 3 periods)
}

// Capture modes
enum HwaNanAutoCapMode {
  MANUALLY = 0,  // Manual capture
  AUTO = 1       // Auto capture
}

// Payment channels
enum HwaNanPaymentChannel {
  CREDIT = 1  // Credit card payments
}
```

## License

MIT
