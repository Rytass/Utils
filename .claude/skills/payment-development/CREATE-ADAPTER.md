# Creating a New Payment Adapter

Step-by-step guide to creating a new payment adapter for `@rytass/payments`.

## Overview

Each adapter package needs to implement these main classes:
1. **Gateway** - Implements `PaymentGateway` interface
2. **Order** - Implements `Order` interface
3. **BindCard** (Optional) - Implements `BindCardPaymentGateway` interface for card binding

## Package Structure

Create a new package with this structure:

```
packages/payments-adapter-{provider}/
├── package.json
├── tsconfig.build.json
├── README.md
├── src/
│   ├── index.ts                    # Main exports
│   ├── {provider}-payment.ts       # Gateway implementation
│   ├── {provider}-order.ts         # Order implementation
│   └── typings.ts                  # Provider-specific types
└── __tests__/
    └── {provider}-payment.spec.ts
```

## Step 1: Package Configuration

### package.json

```json
{
  "name": "@rytass/payments-adapter-{provider}",
  "version": "0.1.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "license": "MIT",
  "peerDependencies": {
    "@rytass/payments": "^0.1.0"
  },
  "devDependencies": {
    "@rytass/payments": "^0.1.0"
  },
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

### tsconfig.build.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

---

## Step 2: Define Provider Types

### src/typings.ts

```typescript
import {
  PaymentItem,
  Channel,
  OrderCommitMessage,
  OrderCreditCardCommitMessage,
  OrderVirtualAccountCommitMessage,
} from '@rytass/payments';

// Provider-specific payment item
export interface {Provider}PaymentItem extends PaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;
  // Add provider-specific fields
  productId?: string;
  description?: string;
}

// Gateway configuration
export interface {Provider}PaymentOptions {
  merchantId: string;
  apiKey: string;
  apiSecret?: string;
  baseUrl?: string;
  withServer?: boolean;          // Enable built-in callback server
  serverHost?: string;           // Callback server host
  serverPort?: number;           // Callback server port
  callbackPath?: string;         // Callback endpoint path
}

// Order preparation options
export interface {Provider}PrepareOptions {
  channel: Channel;
  items: {Provider}PaymentItem[];
  orderId?: string;
  clientBackUrl?: string;        // Return URL after payment
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  // Add provider-specific options
  expiredAt?: Date;              // For async channels
  installment?: number;          // For installment payments
}

// Credit card specific options
export interface {Provider}CreditCardOptions extends {Provider}PrepareOptions {
  channel: Channel.CREDIT_CARD;
  cardNumber?: string;           // For direct payment
  cardExpiry?: string;           // MMYY or YYMM
  cardCvc?: string;              // CVV/CVC
  installment?: 3 | 6 | 12 | 18 | 24; // Installment periods
}

// Virtual account specific options
export interface {Provider}VirtualAccountOptions extends {Provider}PrepareOptions {
  channel: Channel.VIRTUAL_ACCOUNT;
  expiredAt?: Date;              // Payment deadline
}

// Query options
export type {Provider}QueryOptions =
  | { orderId: string }
  | { transactionId: string };

// Provider-specific commit messages
export type {Provider}OrderCommitMessage =
  | OrderCreditCardCommitMessage
  | OrderVirtualAccountCommitMessage;

// Provider-specific constants
export enum {Provider}BaseUrls {
  DEVELOPMENT = 'https://test-api.{provider}.com',
  PRODUCTION = 'https://api.{provider}.com',
}
```

---

## Step 3: Implement Order Class

### src/{provider}-order.ts

```typescript
import {
  Order,
  OrderState,
  Channel,
  OrderCommitMessage,
  OrderFailMessage,
  AdditionalInfo,
  AsyncOrderInformation,
} from '@rytass/payments';
import { {Provider}PaymentItem } from './typings';

export interface {Provider}OrderOptions<OCM extends OrderCommitMessage> {
  id: string;
  items: {Provider}PaymentItem[];
  channel: Channel;
  state?: OrderState;
  createdAt?: Date;
  committedAt?: Date;
  asyncInfo?: AsyncOrderInformation<OCM>;
  additionalInfo?: AdditionalInfo<OCM>;
  // Add provider-specific properties
  formHTML?: string;             // Auto-submit form for redirect
  checkoutURL?: string;          // Direct checkout URL
}

export class {Provider}Order<OCM extends OrderCommitMessage = OrderCommitMessage>
  implements Order<OCM>
{
  readonly id: string;
  readonly items: {Provider}PaymentItem[];
  readonly channel: Channel;

  state: OrderState;
  createdAt: Date | null;
  committedAt: Date | null;
  asyncInfo?: AsyncOrderInformation<OCM>;
  additionalInfo?: AdditionalInfo<OCM>;
  failedMessage: OrderFailMessage | null = null;

  // Provider-specific properties
  formHTML?: string;
  checkoutURL?: string;

  constructor(options: {Provider}OrderOptions<OCM>) {
    this.id = options.id;
    this.items = options.items;
    this.channel = options.channel;
    this.state = options.state ?? OrderState.INITED;
    this.createdAt = options.createdAt ?? null;
    this.committedAt = options.committedAt ?? null;
    this.asyncInfo = options.asyncInfo;
    this.additionalInfo = options.additionalInfo;
    this.formHTML = options.formHTML;
    this.checkoutURL = options.checkoutURL;
  }

  get committable(): boolean {
    return this.state === OrderState.PRE_COMMIT ||
           this.state === OrderState.ASYNC_INFO_RETRIEVED;
  }

  infoRetrieved<T extends OCM>(asyncInformation: AsyncOrderInformation<T>): void {
    this.asyncInfo = asyncInformation as AsyncOrderInformation<OCM>;
    this.state = OrderState.ASYNC_INFO_RETRIEVED;
  }

  fail(code: string, message: string): void {
    this.failedMessage = { code, message };
    this.state = OrderState.FAILED;
  }

  commit<T extends OCM>(message: T, additionalInfo?: AdditionalInfo<T>): void {
    this.committedAt = message.committedAt;
    this.additionalInfo = additionalInfo as AdditionalInfo<OCM>;
    this.state = OrderState.COMMITTED;
  }

  async refund(amount?: number, options?: unknown): Promise<void> {
    // Implement refund logic with provider API
    // This is typically implemented in the gateway class and delegated here
    throw new Error('Refund not implemented');
  }
}
```

---

## Step 4: Implement Gateway Class

### src/{provider}-payment.ts

```typescript
import { EventEmitter } from 'events';
import {
  PaymentGateway,
  Channel,
  OrderState,
  PaymentEvents,
  InputFromOrderCommitMessage,
} from '@rytass/payments';
import {
  {Provider}PaymentOptions,
  {Provider}PrepareOptions,
  {Provider}QueryOptions,
  {Provider}OrderCommitMessage,
  {Provider}BaseUrls,
} from './typings';
import { {Provider}Order } from './{provider}-order';

export class {Provider}Payment
  implements PaymentGateway<{Provider}OrderCommitMessage, {Provider}Order>
{
  readonly emitter = new EventEmitter();

  private readonly merchantId: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly withServer: boolean;
  private server?: any; // HTTP server instance

  // Order cache for queries
  private orders = new Map<string, {Provider}Order>();

  constructor(options: {Provider}PaymentOptions) {
    this.merchantId = options.merchantId;
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret ?? '';
    this.baseUrl = options.baseUrl ?? {Provider}BaseUrls.DEVELOPMENT;
    this.withServer = options.withServer ?? false;

    if (this.withServer) {
      this.initializeServer(options);
    }
  }

  async prepare<N extends {Provider}OrderCommitMessage>(
    input: InputFromOrderCommitMessage<N> & {Provider}PrepareOptions
  ): Promise<{Provider}Order<N>> {
    // 1. Generate order ID
    const orderId = input.id ?? this.generateOrderId();

    // 2. Validate input
    this.validatePrepareInput(input);

    // 3. Build API request payload
    const payload = this.buildPreparePayload(orderId, input);

    // 4. Call provider API
    const response = await this.callApi('/payment/prepare', payload);

    // 5. Create order instance
    const order = new {Provider}Order<N>({
      id: orderId,
      items: input.items,
      channel: input.channel,
      state: OrderState.PRE_COMMIT,
      createdAt: new Date(),
      formHTML: response.formHTML,
      checkoutURL: response.checkoutURL,
    });

    // 6. Cache order for queries
    this.orders.set(orderId, order);

    // 7. Emit event
    this.emitter.emit(PaymentEvents.ORDER_PRE_COMMIT, order);

    // 8. For async channels, may need to fetch async info
    if (this.isAsyncChannel(input.channel)) {
      await this.retrieveAsyncInfo(order, response);
    }

    return order;
  }

  async query<OO extends {Provider}Order>(
    id: string,
    options?: {Provider}QueryOptions
  ): Promise<OO> {
    // 1. Check cache first
    const cachedOrder = this.orders.get(id);
    if (cachedOrder && !options) {
      return cachedOrder as OO;
    }

    // 2. Query from provider API
    const payload = this.buildQueryPayload(id, options);
    const response = await this.callApi('/payment/query', payload);

    // 3. Parse response and create/update order
    const order = this.parseQueryResponse(response);

    // 4. Update cache
    this.orders.set(id, order);

    return order as OO;
  }

  // Private helper methods

  private generateOrderId(): string {
    return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private validatePrepareInput(input: {Provider}PrepareOptions): void {
    if (!input.items?.length) {
      throw new Error('Items cannot be empty');
    }

    if (!input.channel) {
      throw new Error('Channel is required');
    }

    // Add more validation as needed
  }

  private buildPreparePayload(orderId: string, input: {Provider}PrepareOptions): object {
    return {
      merchantId: this.merchantId,
      orderId,
      channel: input.channel,
      amount: this.calculateTotal(input.items),
      items: input.items,
      buyerEmail: input.buyerEmail,
      clientBackUrl: input.clientBackUrl,
      // Add signature/encryption as required by provider
      signature: this.generateSignature({
        orderId,
        amount: this.calculateTotal(input.items),
      }),
    };
  }

  private calculateTotal(items: { unitPrice: number; quantity: number }[]): number {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  private isAsyncChannel(channel: Channel): boolean {
    return [
      Channel.VIRTUAL_ACCOUNT,
      Channel.CVS_KIOSK,
      Channel.CVS_BARCODE,
    ].includes(channel);
  }

  private async retrieveAsyncInfo(
    order: {Provider}Order,
    response: any
  ): Promise<void> {
    // Parse async info from response
    const asyncInfo = this.parseAsyncInfo(order.channel, response);

    if (asyncInfo) {
      order.infoRetrieved(asyncInfo);
      this.emitter.emit(PaymentEvents.ORDER_INFO_RETRIEVED, order);
    }
  }

  private parseAsyncInfo(channel: Channel, response: any): any {
    switch (channel) {
      case Channel.VIRTUAL_ACCOUNT:
        return {
          channel: Channel.VIRTUAL_ACCOUNT,
          bankCode: response.bankCode,
          account: response.account,
          expiredAt: new Date(response.expiredAt),
        };

      case Channel.CVS_KIOSK:
        return {
          channel: Channel.CVS_KIOSK,
          paymentCode: response.paymentCode,
          expiredAt: new Date(response.expiredAt),
        };

      case Channel.CVS_BARCODE:
        return {
          channel: Channel.CVS_BARCODE,
          barcodes: [response.barcode1, response.barcode2, response.barcode3],
          expiredAt: new Date(response.expiredAt),
        };

      default:
        return null;
    }
  }

  private buildQueryPayload(id: string, options?: {Provider}QueryOptions): object {
    return {
      merchantId: this.merchantId,
      orderId: id,
      ...options,
      signature: this.generateSignature({ orderId: id }),
    };
  }

  private parseQueryResponse(response: any): {Provider}Order {
    // Parse provider response and create order
    return new {Provider}Order({
      id: response.orderId,
      items: response.items,
      channel: response.channel,
      state: this.mapProviderState(response.status),
      createdAt: new Date(response.createdAt),
      committedAt: response.committedAt ? new Date(response.committedAt) : null,
    });
  }

  private mapProviderState(providerStatus: string): OrderState {
    // Map provider-specific status to OrderState
    const stateMap: Record<string, OrderState> = {
      'PENDING': OrderState.PRE_COMMIT,
      'SUCCESS': OrderState.COMMITTED,
      'FAILED': OrderState.FAILED,
      'REFUNDED': OrderState.REFUNDED,
    };

    return stateMap[providerStatus] ?? OrderState.INITED;
  }

  private generateSignature(data: object): string {
    // Implement provider-specific signature generation
    // Common methods: SHA256, MD5, HMAC-SHA256, AES encryption
    const crypto = require('crypto');
    const dataString = Object.values(data).join('|');

    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(dataString)
      .digest('hex')
      .toUpperCase();
  }

  private async callApi(endpoint: string, payload: object): Promise<any> {
    // Implement API call with:
    // - Authentication (API key, signatures, etc.)
    // - Request encryption if required
    // - Response decryption if required
    // - Error handling

    const axios = require('axios');

    try {
      const response = await axios.post(`${this.baseUrl}${endpoint}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (response.data.status === 'error') {
        throw new Error(response.data.message);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`API error: ${error.message}`);
    }
  }

  // Built-in callback server (optional)

  private initializeServer(options: {Provider}PaymentOptions): void {
    const express = require('express');
    const app = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const callbackPath = options.callbackPath ?? '/payment/callback';

    app.post(callbackPath, async (req: any, res: any) => {
      try {
        await this.handleCallback(req.body);
        res.send('OK');
      } catch (error: any) {
        console.error('Callback error:', error);
        res.status(400).send('ERROR');
      }
    });

    const port = options.serverPort ?? 3000;
    this.server = app.listen(port, () => {
      this.emitter.emit(PaymentEvents.SERVER_LISTENED, { port });
    });
  }

  private async handleCallback(payload: any): Promise<void> {
    // 1. Verify signature
    if (!this.verifyCallbackSignature(payload)) {
      throw new Error('Invalid signature');
    }

    // 2. Get order
    const orderId = payload.orderId;
    let order = this.orders.get(orderId);

    if (!order) {
      order = await this.query(orderId);
    }

    // 3. Update order based on callback
    if (payload.status === 'SUCCESS') {
      order.commit(
        {
          id: orderId,
          totalPrice: payload.amount,
          committedAt: new Date(),
        },
        this.parseAdditionalInfo(payload)
      );

      this.emitter.emit(PaymentEvents.ORDER_COMMITTED, order);
    } else {
      order.fail(payload.errorCode, payload.errorMessage);
      this.emitter.emit(PaymentEvents.ORDER_FAILED, order);
    }
  }

  private verifyCallbackSignature(payload: any): boolean {
    const { signature, ...data } = payload;
    const expectedSignature = this.generateSignature(data);
    return signature === expectedSignature;
  }

  private parseAdditionalInfo(payload: any): any {
    // Parse provider-specific additional info
    if (payload.channel === Channel.CREDIT_CARD) {
      return {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(payload.processDate),
        authCode: payload.authCode,
        amount: payload.amount,
        eci: payload.eci,
        card4Number: payload.card4Number,
        card6Number: payload.card6Number,
      };
    }

    return undefined;
  }
}
```

---

## Step 5: (Optional) Implement Card Binding

### Add to {provider}-payment.ts

```typescript
import { BindCardPaymentGateway, BindCardRequest, CheckoutWithBoundCardOptions } from '@rytass/payments';

export class {Provider}Payment
  implements
    PaymentGateway<{Provider}OrderCommitMessage, {Provider}Order>,
    BindCardPaymentGateway<{Provider}OrderCommitMessage, BindCardRequest, {Provider}Order>
{
  // ... existing code ...

  async prepareBindCard(memberId: string): Promise<BindCardRequest> {
    // 1. Call provider API to prepare card binding
    const response = await this.callApi('/card/bind/prepare', {
      merchantId: this.merchantId,
      memberId,
    });

    // 2. Return bind card request with form/URL
    return {
      cardId: undefined,
      memberId,
      // Add provider-specific properties
      formHTML: response.formHTML,
      checkoutURL: response.checkoutURL,
    };
  }

  async checkoutWithBoundCard(
    options: CheckoutWithBoundCardOptions
  ): Promise<{Provider}Order> {
    // 1. Validate bound card
    const { cardId, memberId, items, orderId } = options;

    // 2. Call provider API to charge bound card
    const response = await this.callApi('/card/bound/charge', {
      merchantId: this.merchantId,
      cardId,
      memberId,
      orderId: orderId ?? this.generateOrderId(),
      amount: this.calculateTotal(items),
      items,
    });

    // 3. Create order
    const order = new {Provider}Order({
      id: response.orderId,
      items,
      channel: Channel.CREDIT_CARD,
      state: OrderState.COMMITTED,
      createdAt: new Date(),
      committedAt: new Date(),
    });

    // 4. Emit event
    this.emitter.emit(PaymentEvents.ORDER_COMMITTED, order);

    return order;
  }
}
```

---

## Step 6: Export Everything

### src/index.ts

```typescript
// Re-export base types
export {
  Channel,
  OrderState,
  PaymentEvents,
  CardType,
  CreditCardECI,
  CVS,
  PaymentPeriodType,
} from '@rytass/payments';

// Export provider-specific types
export * from './typings';

// Export classes
export { {Provider}Payment } from './{provider}-payment';
export { {Provider}Order } from './{provider}-order';
```

---

## Step 7: Write Tests

### \_\_tests\_\_/{provider}-payment.spec.ts

```typescript
import {
  {Provider}Payment,
  {Provider}Order,
  Channel,
  OrderState,
  PaymentEvents,
} from '../src';

describe('{Provider}Payment', () => {
  let payment: {Provider}Payment;

  beforeEach(() => {
    payment = new {Provider}Payment({
      merchantId: 'TEST_MERCHANT',
      apiKey: 'TEST_API_KEY',
      apiSecret: 'TEST_API_SECRET',
    });
  });

  describe('prepare', () => {
    it('should prepare a credit card order', async () => {
      const order = await payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [
          { name: 'Test Product', unitPrice: 10000, quantity: 1 },
        ],
      });

      expect(order).toBeInstanceOf({Provider}Order);
      expect(order.state).toBe(OrderState.PRE_COMMIT);
      expect(order.id).toBeDefined();
      expect(order.formHTML || order.checkoutURL).toBeDefined();
    });

    it('should prepare a virtual account order with async info', async () => {
      const order = await payment.prepare({
        channel: Channel.VIRTUAL_ACCOUNT,
        items: [{ name: 'Product', unitPrice: 5000, quantity: 1 }],
      });

      expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
      expect(order.asyncInfo?.channel).toBe(Channel.VIRTUAL_ACCOUNT);
      expect(order.asyncInfo?.account).toBeDefined();
      expect(order.asyncInfo?.bankCode).toBeDefined();
    });

    it('should emit ORDER_PRE_COMMIT event', async () => {
      const listener = jest.fn();
      payment.emitter.on(PaymentEvents.ORDER_PRE_COMMIT, listener);

      await payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{ name: 'Product', unitPrice: 1000, quantity: 1 }],
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('query', () => {
    it('should query an existing order', async () => {
      const prepared = await payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{ name: 'Product', unitPrice: 1000, quantity: 1 }],
      });

      const queried = await payment.query(prepared.id);

      expect(queried.id).toBe(prepared.id);
    });
  });

  describe('event handling', () => {
    it('should emit ORDER_COMMITTED on successful payment', (done) => {
      payment.emitter.on(PaymentEvents.ORDER_COMMITTED, (order) => {
        expect(order.state).toBe(OrderState.COMMITTED);
        expect(order.committedAt).toBeInstanceOf(Date);
        done();
      });

      // Simulate callback
      // This would be triggered by provider's webhook
    });

    it('should emit ORDER_FAILED on failed payment', (done) => {
      payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => {
        expect(order.state).toBe(OrderState.FAILED);
        expect(order.failedMessage).toBeDefined();
        done();
      });

      // Simulate failed callback
    });
  });

  describe('card binding', () => {
    it('should prepare card binding', async () => {
      const bindRequest = await payment.prepareBindCard('MEMBER_001');

      expect(bindRequest.memberId).toBe('MEMBER_001');
      expect(bindRequest.formHTML || bindRequest.checkoutURL).toBeDefined();
    });

    it('should checkout with bound card', async () => {
      const order = await payment.checkoutWithBoundCard({
        cardId: 'CARD_123',
        memberId: 'MEMBER_001',
        items: [{ name: 'Product', unitPrice: 2000, quantity: 1 }],
      });

      expect(order.state).toBe(OrderState.COMMITTED);
    });
  });
});
```

---

## Publish Checklist

Before publishing your adapter:

- [ ] All `PaymentGateway` methods implemented
- [ ] Event emitter properly configured and emitting all events
- [ ] Proper error handling for API failures
- [ ] Request/response encryption/signature (if required by provider)
- [ ] Test credentials configured for development
- [ ] Unit tests written and passing
- [ ] Integration tests with provider sandbox
- [ ] README.md with:
  - Installation instructions
  - Quick start example
  - All payment channels supported
  - Event listening examples
  - Card binding examples (if supported)
  - Configuration options
- [ ] TypeScript types properly exported
- [ ] Built-in callback server tested (if implemented)
- [ ] Version number set appropriately

---

## Reference Implementations

Study existing adapters for implementation patterns:

| Adapter | Key Features |
|---------|--------------|
| `payments-adapter-ecpay` | AES encryption, installments, card binding, recurring payments, built-in server + Ngrok |
| `payments-adapter-newebpay` | Multi-language UI, 6 payment channels, card binding |
| `payments-adapter-hwanan` | MAC signature, installments, multi-language pages |
| `payments-adapter-ctbc-micro-fast-pay` | MAC/TXN dual signatures, 6 channels, card binding |
| `payments-adapter-icash-pay` | RSA + AES encryption, barcode scanning, member integration |
| `payments-adapter-happy-card` | Gift card balance query, dual payment (amount + bonus) |

---

## Common Implementation Patterns

### Signature Generation

Different providers use different signature methods:

```typescript
// SHA256 HMAC
private generateSignature(data: object): string {
  const crypto = require('crypto');
  const dataString = Object.values(data).join('|');
  return crypto.createHmac('sha256', this.apiSecret).update(dataString).digest('hex');
}

// MD5
private generateMD5Signature(data: object): string {
  const crypto = require('crypto');
  const dataString = Object.values(data).join('');
  return crypto.createHash('md5').update(dataString).digest('hex');
}

// AES Encryption
private encryptAES(data: string): string {
  const crypto = require('crypto');
  const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
  return cipher.update(data, 'utf8', 'base64') + cipher.final('base64');
}
```

### Form Generation

For redirect-based payments:

```typescript
private generateFormHTML(orderId: string, payload: object): string {
  const fields = Object.entries(payload)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}">`)
    .join('\n');

  return `
    <form id="payment-form" method="POST" action="${this.baseUrl}/checkout">
      ${fields}
    </form>
    <script>document.getElementById('payment-form').submit();</script>
  `;
}
```

### Built-in Server with Ngrok

For development with external webhooks:

```typescript
async listen(port: number, options?: { ngrok?: boolean }): Promise<void> {
  // Start Express server
  this.server = app.listen(port);

  // Start Ngrok tunnel if enabled
  if (options?.ngrok) {
    const ngrok = require('ngrok');
    const url = await ngrok.connect(port);
    console.log('Ngrok URL:', url);
  }
}
```
