# Rytass Utils - Payments NestJS Module

A comprehensive payment system module designed specifically for NestJS applications, providing a unified payment gateway integration interface with full dependency injection support. This module seamlessly integrates multiple Taiwan payment service providers including ECPay, NewebPay, HwaNan, CTBC, iCash Pay, and Happy Card, with automatic webhook handling, built-in server support, and enterprise-grade TypeScript type safety.

## Features

- [x] **NestJS Integration**: Full dependency injection support with decorators
- [x] **Unified Interface**: Single API for multiple Taiwan payment providers
- [x] **Automatic Webhooks**: Built-in callback endpoint handling with `/payments/callbacks`
- [x] **Server Support**: Integrated payment server with checkout endpoints
- [x] **TypeScript Safety**: Complete type definitions and compile-time validation
- [x] **Multi-Provider**: Support for ECPay, NewebPay, HwaNan, CTBC, iCash Pay, Happy Card
- [x] **Event-Driven**: Payment lifecycle event handling with EventEmitter
- [x] **Configuration**: Sync and async module configuration options
- [x] **Error Handling**: Comprehensive error management and logging
- [x] **Testing Support**: Mock providers and testing utilities
- [x] **Production Ready**: Built-in security, caching, and performance optimizations
- [x] **Member Integration**: Seamless integration with member management systems

## Installation

```bash
npm install @rytass/payments-nestjs-module @rytass/payments
# Install required payment adapters
npm install @rytass/payments-adapter-ecpay
npm install @rytass/payments-adapter-newebpay
npm install @rytass/payments-adapter-hwanan
npm install @rytass/payments-adapter-ctbc-micro-fast-pay
npm install @rytass/payments-adapter-icash-pay
npm install @rytass/payments-adapter-happy-card
# or
yarn add @rytass/payments-nestjs-module @rytass/payments
yarn add @rytass/payments-adapter-ecpay @rytass/payments-adapter-newebpay
```

**Peer Dependencies:**
```bash
npm install @nestjs/common @nestjs/core
```

## Basic Usage

### Module Configuration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { PaymentsModule } from '@rytass/payments-nestjs-module';
import { ECPayPayment } from '@rytass/payments-adapter-ecpay';

@Module({
  imports: [
    PaymentsModule.forRoot({
      gateway: new ECPayPayment({
        merchantId: process.env.ECPAY_MERCHANT_ID!,
        hashKey: process.env.ECPAY_HASH_KEY!,
        hashIv: process.env.ECPAY_HASH_IV!,
        serverHost: process.env.SERVER_HOST || 'http://localhost:3000',
        withServer: true,
        onCommit: (order) => {
          console.log('Payment committed:', order);
        }
      })
    })
  ],
  // ...
})
export class AppModule {}
```

### Async Configuration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentsModule } from '@rytass/payments-nestjs-module';
import { ECPayPayment } from '@rytass/payments-adapter-ecpay';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PaymentsModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        gateway: new ECPayPayment({
          merchantId: configService.get('ECPAY_MERCHANT_ID')!,
          hashKey: configService.get('ECPAY_HASH_KEY')!,
          hashIv: configService.get('ECPAY_HASH_IV')!,
          serverHost: configService.get('SERVER_HOST') || 'http://localhost:3000',
          withServer: true,
          onCommit: (order) => {
            // Handle payment completion
          }
        })
      })
    })
  ],
})
export class AppModule {}
```

### Using in Services

```typescript
// payment.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PaymentGateway, Channel, PaymentEvents, OrderState } from '@rytass/payments';
import { PAYMENTS_GATEWAY } from '@rytass/payments-nestjs-module';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject(PAYMENTS_GATEWAY)
    private readonly paymentGateway: PaymentGateway
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.paymentGateway.emitter?.on(PaymentEvents.ORDER_COMMITTED, (message) => {
      this.logger.log(`Payment committed: ${message.id}`);
      this.handlePaymentSuccess(message);
    });

    this.paymentGateway.emitter?.on(PaymentEvents.ORDER_FAILED, (failure) => {
      this.logger.error(`Payment failed: ${failure.code} - ${failure.message}`);
      this.handlePaymentFailure(failure);
    });
  }

  async createPayment(orderData: {
    itemName: string;
    amount: number;
    quantity?: number;
    channel?: Channel;
    returnUrl?: string;
  }) {
    try {
      const order = await this.paymentGateway.prepare({
        channel: orderData.channel || Channel.CREDIT_CARD,
        items: [
          {
            name: orderData.itemName,
            unitPrice: orderData.amount,
            quantity: orderData.quantity || 1
          }
        ],
        clientBackUrl: orderData.returnUrl
      });

      this.logger.log(`Payment order created: ${order.id}`);

      return {
        orderId: order.id,
        totalAmount: order.totalPrice,
        checkoutUrl: order.checkoutURL,
        formHtml: order.formHTML,
        formData: order.form,
        state: order.state,
        createdAt: order.createdAt
      };
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`);
      throw error;
    }
  }

  async queryPayment(orderId: string) {
    try {
      const order = await this.paymentGateway.query(orderId);
      
      return {
        orderId: order.id,
        state: order.state,
        totalAmount: order.totalPrice,
        createdAt: order.createdAt,
        committedAt: order.committedAt,
        isCommitted: order.state === OrderState.COMMITTED,
        isFailed: order.state === OrderState.FAILED
      };
    } catch (error) {
      this.logger.error(`Failed to query payment ${orderId}: ${error.message}`);
      throw error;
    }
  }

  private async handlePaymentSuccess(message: any) {
    // Implement your business logic here
    // Update database, send notifications, etc.
  }

  private async handlePaymentFailure(failure: any) {
    // Implement failure handling logic
    // Log errors, notify customer, etc.
  }
}
```

### Controller Integration

```typescript
// payment.controller.ts
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  async createPayment(@Body() createPaymentDto: any) {
    return await this.paymentService.createPayment(createPaymentDto);
  }

  @Get('status/:orderId')
  async getPaymentStatus(@Param('orderId') orderId: string) {
    return await this.paymentService.queryPayment(orderId);
  }
}
```

## Built-in Endpoints

The module automatically provides the following REST endpoints:

### Payment Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| `GET` | `/payments/checkout/:orderNo` | Payment checkout page for order | Public |
| `POST` | `/payments/callbacks` | Payment gateway callbacks and webhooks | Public |

### Endpoint Details

#### Checkout Endpoint
```typescript
// GET /payments/checkout/ORDER-2024-001
// Automatically serves the payment form for the specified order
// Integrates with the payment gateway's built-in server listener
```

#### Callback Endpoint
```typescript
// POST /payments/callbacks
// Handles all payment gateway callbacks including:
// - Payment success/failure notifications
// - Async payment info (Virtual Account, CVS codes)
// - Card binding confirmations
// - Refund notifications
```

**Note**: These endpoints are automatically registered and marked as public (no authentication required) using the `@IsPublic()` decorator from the member management system.

## Multiple Payment Gateways

### Custom Module with Multiple Providers

```typescript
// payments.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ECPayPayment } from '@rytass/payments-adapter-ecpay';
import { NewebPayPayment } from '@rytass/payments-adapter-newebpay';
import { HwaNanPayment } from '@rytass/payments-adapter-hwanan';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'ECPAY_GATEWAY',
      useFactory: (configService: ConfigService) => {
        return new ECPayPayment({
          merchantId: configService.get('ECPAY_MERCHANT_ID'),
          hashKey: configService.get('ECPAY_HASH_KEY'),
          hashIv: configService.get('ECPAY_HASH_IV'),
          withServer: true,
          serverHost: configService.get('SERVER_HOST')
        });
      },
      inject: [ConfigService]
    },
    {
      provide: 'NEWEBPAY_GATEWAY',
      useFactory: (configService: ConfigService) => {
        return new NewebPayPayment({
          merchantId: configService.get('NEWEBPAY_MERCHANT_ID'),
          hashKey: configService.get('NEWEBPAY_HASH_KEY'),
          hashIv: configService.get('NEWEBPAY_HASH_IV'),
          withServer: true,
          serverHost: configService.get('SERVER_HOST')
        });
      },
      inject: [ConfigService]
    },
    {
      provide: 'HWANAN_GATEWAY',
      useFactory: (configService: ConfigService) => {
        return new HwaNanPayment({
          merchantId: configService.get('HWANAN_MERCHANT_ID'),
          terminalId: configService.get('HWANAN_TERMINAL_ID'),
          merID: configService.get('HWANAN_MER_ID'),
          merchantName: configService.get('HWANAN_MERCHANT_NAME'),
          identifier: configService.get('HWANAN_IDENTIFIER'),
          withServer: true
        });
      },
      inject: [ConfigService]
    }
  ],
  exports: ['ECPAY_GATEWAY', 'NEWEBPAY_GATEWAY', 'HWANAN_GATEWAY']
})
export class MultiPaymentsModule {}
```

### Multi-Gateway Service

```typescript
// multi-payment.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Channel } from '@rytass/payments';

enum PaymentProvider {
  ECPAY = 'ecpay',
  NEWEBPAY = 'newebpay', 
  HWANAN = 'hwanan'
}

@Injectable()
export class MultiPaymentService {
  constructor(
    @Inject('ECPAY_GATEWAY') private ecpayGateway: any,
    @Inject('NEWEBPAY_GATEWAY') private newebpayGateway: any,
    @Inject('HWANAN_GATEWAY') private hwananGateway: any
  ) {}

  private getGateway(provider: PaymentProvider) {
    switch (provider) {
      case PaymentProvider.ECPAY:
        return this.ecpayGateway;
      case PaymentProvider.NEWEBPAY:
        return this.newebpayGateway;
      case PaymentProvider.HWANAN:
        return this.hwananGateway;
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }

  async createPayment(provider: PaymentProvider, orderData: {
    items: Array<{
      name: string;
      unitPrice: number;
      quantity: number;
    }>;
    channel?: Channel;
    returnUrl?: string;
  }) {
    const gateway = this.getGateway(provider);
    
    const order = await gateway.prepare({
      channel: orderData.channel || Channel.CREDIT_CARD,
      items: orderData.items,
      clientBackUrl: orderData.returnUrl
    });

    return {
      provider,
      orderId: order.id,
      checkoutUrl: order.checkoutURL,
      totalAmount: order.totalPrice
    };
  }

  async queryPayment(provider: PaymentProvider, orderId: string) {
    const gateway = this.getGateway(provider);
    return await gateway.query(orderId);
  }

  getSupportedChannels(provider: PaymentProvider): Channel[] {
    switch (provider) {
      case PaymentProvider.ECPAY:
        return [Channel.CREDIT_CARD, Channel.WEB_ATM, Channel.VIRTUAL_ACCOUNT, Channel.CVS_KIOSK];
      case PaymentProvider.NEWEBPAY:
        return [Channel.CREDIT_CARD, Channel.WEB_ATM, Channel.VIRTUAL_ACCOUNT, Channel.CVS_KIOSK];
      case PaymentProvider.HWANAN:
        return [Channel.CREDIT_CARD];
      default:
        return [];
    }
  }
}
```

## Configuration Options

### PaymentsModuleOptions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `gateway` | `PaymentGateway & WithServerGateway` | Yes | Payment gateway instance |

### Environment Variables

```bash
# .env
# Server Configuration
SERVER_HOST=https://your-domain.com
PORT=3000
NODE_ENV=production

# ECPay Configuration
ECPAY_MERCHANT_ID=your_ecpay_merchant_id
ECPAY_HASH_KEY=your_ecpay_hash_key
ECPAY_HASH_IV=your_ecpay_hash_iv

# NewebPay Configuration  
NEWEBPAY_MERCHANT_ID=your_newebpay_merchant_id
NEWEBPAY_HASH_KEY=your_newebpay_hash_key
NEWEBPAY_HASH_IV=your_newebpay_hash_iv

# HwaNan Bank Configuration
HWANAN_MERCHANT_ID=your_hwanan_merchant_id
HWANAN_TERMINAL_ID=your_hwanan_terminal_id
HWANAN_MER_ID=your_hwanan_mer_id
HWANAN_MERCHANT_NAME=your_store_name
HWANAN_IDENTIFIER=your_hwanan_identifier

# CTBC Configuration
CTBC_MERCHANT_ID=your_ctbc_merchant_id
CTBC_MER_ID=your_ctbc_mer_id
CTBC_TXN_KEY=your_ctbc_txn_key
CTBC_TERMINAL_ID=your_ctbc_terminal_id

# iCash Pay Configuration
ICASH_PAY_MERCHANT_ID=your_icash_pay_merchant_id
ICASH_PAY_CLIENT_PRIVATE_KEY=your_client_private_key
ICASH_PAY_SERVER_PUBLIC_KEY=icash_pay_server_public_key
ICASH_PAY_AES_KEY_ID=your_aes_key_id
ICASH_PAY_AES_KEY=your_32_char_aes_key
ICASH_PAY_AES_IV=your_16_char_aes_iv

# Happy Card Configuration
HAPPY_CARD_C_SOURCE=your_happy_card_c_source
HAPPY_CARD_SECRET_KEY=your_happy_card_secret_key
```

## Advanced Usage

### Custom Webhook Handling

```typescript
// custom-payment.controller.ts
import { Controller, Post, Get, Req, Res, Inject, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { PAYMENTS_GATEWAY } from '@rytass/payments-nestjs-module';
import { IsPublic } from '@rytass/member-base-nestjs-module';

@Controller('custom-payment')
export class CustomPaymentController {
  private readonly logger = new Logger(CustomPaymentController.name);

  constructor(
    @Inject(PAYMENTS_GATEWAY)
    private readonly gateway: any
  ) {}

  @IsPublic()
  @Post('webhook')
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    this.logger.log('Received payment webhook');
    
    try {
      // Custom pre-processing logic
      await this.preprocessWebhook(req);
      
      // Use built-in webhook handler
      if (this.gateway.defaultServerListener) {
        await this.gateway.defaultServerListener(req, res);
      }
      
      // Custom post-processing logic
      await this.postprocessWebhook(req);
      
    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      res.status(400).send('Webhook processing failed');
    }
  }

  @IsPublic()
  @Get('checkout/:orderId')
  async customCheckout(
    @Param('orderId') orderId: string,
    @Req() req: Request, 
    @Res() res: Response
  ) {
    // Custom checkout page logic
    try {
      const order = await this.gateway.query(orderId);
      
      if (!order) {
        return res.status(404).send('Order not found');
      }
      
      // Custom checkout page rendering
      res.render('checkout', {
        order,
        formData: order.form,
        actionUrl: 'https://payment-gateway.com/submit'
      });
      
    } catch (error) {
      this.logger.error(`Checkout failed for order ${orderId}:`, error);
      res.status(500).send('Checkout failed');
    }
  }

  private async preprocessWebhook(req: Request) {
    // Implement custom validation, logging, etc.
    this.logger.log('Preprocessing webhook data');
    
    // Validate webhook signature
    // Log webhook data for audit
    // Rate limiting checks
  }

  private async postprocessWebhook(req: Request) {
    // Implement custom business logic
    this.logger.log('Postprocessing webhook data');
    
    // Send notifications
    // Update external systems
    // Trigger business workflows
  }
}
```

### Payment Strategy Pattern

```typescript
// payment-strategy.service.ts
import { Injectable } from '@nestjs/common';
import { Channel } from '@rytass/payments';

interface PaymentStrategy {
  canHandle(amount: number, channel: Channel): boolean;
  getProvider(): string;
  getRecommendedChannel(): Channel;
}

@Injectable()
export class SmallAmountStrategy implements PaymentStrategy {
  canHandle(amount: number, channel: Channel): boolean {
    return amount <= 1000;
  }
  
  getProvider(): string {
    return 'ecpay'; // ECPay for small amounts
  }
  
  getRecommendedChannel(): Channel {
    return Channel.CREDIT_CARD;
  }
}

@Injectable()
export class LargeAmountStrategy implements PaymentStrategy {
  canHandle(amount: number, channel: Channel): boolean {
    return amount > 10000;
  }
  
  getProvider(): string {
    return 'ctbc'; // CTBC for large amounts with installments
  }
  
  getRecommendedChannel(): Channel {
    return Channel.CREDIT_CARD;
  }
}

@Injectable()
export class PaymentStrategyService {
  private strategies: PaymentStrategy[] = [
    new SmallAmountStrategy(),
    new LargeAmountStrategy()
  ];
  
  selectStrategy(amount: number, preferredChannel?: Channel): PaymentStrategy {
    return this.strategies.find(strategy => 
      strategy.canHandle(amount, preferredChannel || Channel.CREDIT_CARD)
    ) || this.strategies[0]; // Default to first strategy
  }
  
  getOptimalProvider(amount: number, channel?: Channel): {
    provider: string;
    recommendedChannel: Channel;
  } {
    const strategy = this.selectStrategy(amount, channel);
    return {
      provider: strategy.getProvider(),
      recommendedChannel: strategy.getRecommendedChannel()
    };
  }
}
```

### Card Binding Integration

```typescript
// card-binding.service.ts
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { PaymentEvents } from '@rytass/payments';
import { PAYMENTS_GATEWAY } from '@rytass/payments-nestjs-module';

@Injectable()
export class CardBindingService {
  constructor(
    @Inject(PAYMENTS_GATEWAY)
    private readonly gateway: any
  ) {
    this.setupCardBindingListeners();
  }

  private setupCardBindingListeners() {
    this.gateway.emitter?.on(PaymentEvents.CARD_BOUND, (bindRequest) => {
      this.handleCardBound(bindRequest);
    });

    this.gateway.emitter?.on(PaymentEvents.CARD_BINDING_FAILED, (bindRequest) => {
      this.handleCardBindingFailed(bindRequest);
    });
  }

  async bindCardWithTransaction(
    memberId: string, 
    platformTradeNumber: string, 
    orderId: string
  ) {
    try {
      // Check if gateway supports card binding
      if (!this.gateway.bindCardWithTransaction) {
        throw new BadRequestException('Card binding not supported by current gateway');
      }

      const bindRequest = await this.gateway.bindCardWithTransaction(
        memberId,
        platformTradeNumber,
        orderId
      );

      return {
        success: true,
        cardId: bindRequest.cardId,
        memberId: bindRequest.memberId,
        cardInfo: {
          prefix: bindRequest.cardNumberPrefix,
          suffix: bindRequest.cardNumberSuffix
        }
      };
    } catch (error) {
      throw new BadRequestException(`Card binding failed: ${error.message}`);
    }
  }

  async checkoutWithBoundCard(options: {
    memberId: string;
    cardId: string;
    orderId?: string;
    items: Array<{
      name: string;
      unitPrice: number;
      quantity: number;
    }>;
  }) {
    try {
      if (!this.gateway.checkoutWithBoundCard) {
        throw new BadRequestException('Bound card checkout not supported');
      }

      const result = await this.gateway.checkoutWithBoundCard(options);
      
      return {
        success: result.success,
        orderId: result.orderId,
        transactionId: result.transactionId,
        amount: result.amount
      };
    } catch (error) {
      throw new BadRequestException(`Bound card checkout failed: ${error.message}`);
    }
  }

  private async handleCardBound(bindRequest: any) {
    // Save bound card to database
    // Send notification to user
    // Update member profile
  }

  private async handleCardBindingFailed(bindRequest: any) {
    // Log failure
    // Notify customer service
    // Handle already bound scenario
    if (bindRequest.failedMessage?.code === '10100112') {
      // Card already bound - handle gracefully
    }
  }
}
```

### Payment Event Handling

```typescript
// payment-events.service.ts
import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { PaymentEvents } from '@rytass/payments';
import { PAYMENTS_GATEWAY } from '@rytass/payments-nestjs-module';

@Injectable()
export class PaymentEventsService implements OnModuleInit {
  constructor(
    @Inject(PAYMENTS_GATEWAY)
    private readonly gateway: any
  ) {}

  onModuleInit() {
    // Listen to payment events
    this.gateway.emitter?.on(PaymentEvents.ORDER_COMMITTED, (order) => {
      console.log('Order committed:', order);
      // Handle order completion logic
    });

    this.gateway.emitter?.on(PaymentEvents.ORDER_FAILED, (order) => {
      console.log('Order failed:', order);
      // Handle payment failure logic
    });
  }
}
```

## Testing

### Unit Testing

```typescript
// payment.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PAYMENTS_GATEWAY } from '@rytass/payments-nestjs-module';
import { Channel, OrderState, PaymentEvents } from '@rytass/payments';
import { EventEmitter } from 'events';

describe('PaymentService', () => {
  let service: PaymentService;
  let mockGateway: any;
  let mockEmitter: EventEmitter;

  beforeEach(async () => {
    mockEmitter = new EventEmitter();
    
    mockGateway = {
      prepare: jest.fn(),
      query: jest.fn(),
      emitter: mockEmitter,
      bindCardWithTransaction: jest.fn(),
      checkoutWithBoundCard: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PAYMENTS_GATEWAY,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('createPayment', () => {
    it('should create payment order successfully', async () => {
      const mockOrder = {
        id: 'test-order-001',
        checkoutURL: 'http://test-checkout.com',
        formHTML: '<form>...</form>',
        form: { key: 'value' },
        totalPrice: 1000,
        state: OrderState.PRE_COMMIT,
        createdAt: new Date()
      };
      
      mockGateway.prepare.mockResolvedValue(mockOrder);

      const result = await service.createPayment({
        itemName: 'Test Product',
        amount: 1000,
        quantity: 1,
        channel: Channel.CREDIT_CARD
      });

      expect(result.orderId).toBe('test-order-001');
      expect(result.totalAmount).toBe(1000);
      expect(result.checkoutUrl).toBe('http://test-checkout.com');
      expect(mockGateway.prepare).toHaveBeenCalledWith({
        channel: Channel.CREDIT_CARD,
        items: [{
          name: 'Test Product',
          unitPrice: 1000,
          quantity: 1
        }],
        clientBackUrl: undefined
      });
    });

    it('should handle payment creation error', async () => {
      mockGateway.prepare.mockRejectedValue(new Error('Gateway error'));

      await expect(service.createPayment({
        itemName: 'Test Product',
        amount: 1000
      })).rejects.toThrow('Gateway error');
    });
  });

  describe('queryPayment', () => {
    it('should query payment status', async () => {
      const mockOrder = {
        id: 'test-order-001',
        state: OrderState.COMMITTED,
        totalPrice: 1000,
        createdAt: new Date(),
        committedAt: new Date()
      };
      
      mockGateway.query.mockResolvedValue(mockOrder);

      const result = await service.queryPayment('test-order-001');

      expect(result.orderId).toBe('test-order-001');
      expect(result.state).toBe(OrderState.COMMITTED);
      expect(result.isCommitted).toBe(true);
      expect(result.isFailed).toBe(false);
    });

    it('should handle query error', async () => {
      mockGateway.query.mockRejectedValue(new Error('Order not found'));

      await expect(service.queryPayment('invalid-order'))
        .rejects.toThrow('Order not found');
    });
  });

  describe('payment events', () => {
    it('should handle payment success event', (done) => {
      const handleSuccessSpy = jest.spyOn(service as any, 'handlePaymentSuccess');
      
      mockEmitter.emit(PaymentEvents.ORDER_COMMITTED, {
        id: 'test-order-001',
        totalPrice: 1000
      });

      setTimeout(() => {
        expect(handleSuccessSpy).toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should handle payment failure event', (done) => {
      const handleFailureSpy = jest.spyOn(service as any, 'handlePaymentFailure');
      
      mockEmitter.emit(PaymentEvents.ORDER_FAILED, {
        code: 'PAYMENT_DECLINED',
        message: 'Payment was declined'
      });

      setTimeout(() => {
        expect(handleFailureSpy).toHaveBeenCalled();
        done();
      }, 100);
    });
  });
});
```

### Integration Testing

```typescript
// payment.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PaymentsModule } from '@rytass/payments-nestjs-module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('Payment Integration', () => {
  let app: INestApplication;
  let paymentService: PaymentService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PaymentsModule.forRoot({
          gateway: new MockPaymentGateway() // Use test gateway
        })
      ],
      controllers: [PaymentController],
      providers: [PaymentService]
    }).compile();

    app = moduleFixture.createNestApplication();
    paymentService = moduleFixture.get<PaymentService>(PaymentService);
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /payment/create', () => {
    it('should create payment and return checkout URL', () => {
      return request(app.getHttpServer())
        .post('/payment/create')
        .send({
          itemName: 'Integration Test Product',
          amount: 2500,
          quantity: 1
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.orderId).toBeDefined();
          expect(res.body.checkoutUrl).toBeDefined();
          expect(res.body.totalAmount).toBe(2500);
        });
    });
  });

  describe('GET /payment/status/:orderId', () => {
    it('should return payment status', async () => {
      // First create a payment
      const createResponse = await request(app.getHttpServer())
        .post('/payment/create')
        .send({
          itemName: 'Status Test Product',
          amount: 1500
        });

      const orderId = createResponse.body.orderId;

      // Then query the status
      return request(app.getHttpServer())
        .get(`/payment/status/${orderId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.orderId).toBe(orderId);
          expect(res.body.state).toBeDefined();
          expect(res.body.totalAmount).toBe(1500);
        });
    });
  });

  describe('GET /payments/checkout/:orderNo', () => {
    it('should serve checkout page', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/payment/create')
        .send({
          itemName: 'Checkout Test Product',
          amount: 3000
        });

      const orderId = createResponse.body.orderId;

      return request(app.getHttpServer())
        .get(`/payments/checkout/${orderId}`)
        .expect(200);
    });
  });

  describe('POST /payments/callbacks', () => {
    it('should handle payment callback', () => {
      return request(app.getHttpServer())
        .post('/payments/callbacks')
        .send({
          // Mock callback data
          orderId: 'test-callback-order',
          status: 'success',
          amount: 1000
        })
        .expect(200);
    });
  });
});

// Mock gateway for testing
class MockPaymentGateway {
  emitter = new EventEmitter();
  
  async prepare(options: any) {
    return {
      id: `mock-order-${Date.now()}`,
      checkoutURL: 'http://mock-checkout.com',
      formHTML: '<form>Mock Form</form>',
      form: { mockKey: 'mockValue' },
      totalPrice: options.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0),
      state: 'PRE_COMMIT',
      createdAt: new Date()
    };
  }
  
  async query(orderId: string) {
    return {
      id: orderId,
      state: 'COMMITTED',
      totalPrice: 1000,
      createdAt: new Date(),
      committedAt: new Date()
    };
  }
  
  defaultServerListener(req: any, res: any) {
    res.status(200).send('OK');
  }
}
```

### E2E Testing

```typescript
// payment.e2e.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Payment E2E', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should complete payment flow', async () => {
    // Step 1: Create payment
    const createResponse = await request(app.getHttpServer())
      .post('/payment/create')
      .send({
        itemName: 'E2E Test Product',
        amount: 5000,
        quantity: 2
      })
      .expect(201);

    const { orderId, checkoutUrl } = createResponse.body;
    expect(orderId).toBeDefined();
    expect(checkoutUrl).toBeDefined();

    // Step 2: Check initial status
    await request(app.getHttpServer())
      .get(`/payment/status/${orderId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.state).toBe('PRE_COMMIT');
        expect(res.body.totalAmount).toBe(10000);
      });

    // Step 3: Access checkout page
    await request(app.getHttpServer())
      .get(`/payments/checkout/${orderId}`)
      .expect(200);

    // Step 4: Simulate payment callback
    await request(app.getHttpServer())
      .post('/payments/callbacks')
      .send({
        orderId,
        status: 'success',
        transactionId: 'mock-txn-123'
      })
      .expect(200);

    // Step 5: Verify final status
    await request(app.getHttpServer())
      .get(`/payment/status/${orderId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.isCommitted).toBe(true);
      });
  });
});
```
```

## Error Handling

```typescript
// payment.service.ts
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class PaymentService {
  async createPayment(orderData: any) {
    try {
      const order = this.paymentGateway.prepare({
        channel: Channel.CREDIT_CARD,
        items: orderData.items
      });
      
      return order;
    } catch (error) {
      if (error.message.includes('Invalid item')) {
        throw new BadRequestException('Invalid payment items');
      }
      
      throw new InternalServerErrorException('Payment creation failed');
    }
  }
}
```

## Performance and Monitoring

### Health Checks

```typescript
// payment-health.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PAYMENTS_GATEWAY } from '@rytass/payments-nestjs-module';

@Injectable()
export class PaymentHealthService extends HealthIndicator {
  constructor(
    @Inject(PAYMENTS_GATEWAY)
    private readonly gateway: any
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Test gateway connectivity
      const testOrderId = `health-check-${Date.now()}`;
      
      // Attempt to query a non-existent order to test gateway
      try {
        await this.gateway.query(testOrderId);
      } catch (error) {
        // Expected error for non-existent order is OK
        if (error.message.includes('not found')) {
          return this.getStatus(key, true, { gateway: 'responsive' });
        }
      }
      
      return this.getStatus(key, true, { gateway: 'healthy' });
    } catch (error) {
      throw new HealthCheckError(
        'Payment gateway health check failed',
        this.getStatus(key, false, { error: error.message })
      );
    }
  }
}
```

### Logging and Monitoring

```typescript
// payment-logger.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PaymentEvents } from '@rytass/payments';

@Injectable()
export class PaymentLoggerService {
  private readonly logger = new Logger(PaymentLoggerService.name);
  
  logPaymentEvent(event: string, data: any) {
    this.logger.log(`Payment Event: ${event}`, {
      event,
      orderId: data.id,
      amount: data.totalPrice,
      timestamp: new Date().toISOString()
    });
  }
  
  logPaymentError(error: any, context: string) {
    this.logger.error(`Payment Error in ${context}:`, {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }
  
  logPerformanceMetric(operation: string, duration: number, success: boolean) {
    this.logger.log(`Payment Performance: ${operation}`, {
      operation,
      duration,
      success,
      timestamp: new Date().toISOString()
    });
  }
}
```

## Security Considerations

### Input Validation

```typescript
// payment-validation.dto.ts
import { IsString, IsNumber, IsOptional, IsEnum, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Channel } from '@rytass/payments';

export class PaymentItemDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  unitPrice: number;

  @IsNumber()
  @Min(1)
  @Max(999)
  quantity: number;
}

export class CreatePaymentDto {
  @IsString()
  itemName: string;

  @IsNumber()
  @Min(1)
  @Max(999999)
  amount: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(999)
  quantity?: number;

  @IsOptional()
  @IsEnum(Channel)
  channel?: Channel;

  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  items?: PaymentItemDto[];
}
```

### Rate Limiting

```typescript
// payment.controller.ts with rate limiting
import { Controller, Post, Body, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payment')
@UseGuards(ThrottlerGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  @Throttle(5, 60) // 5 requests per minute
  @UsePipes(new ValidationPipe({ transform: true }))
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return await this.paymentService.createPayment(createPaymentDto);
  }

  @Get('status/:orderId')
  @Throttle(10, 60) // 10 requests per minute
  async getPaymentStatus(@Param('orderId') orderId: string) {
    return await this.paymentService.queryPayment(orderId);
  }
}
```

## Best Practices

### Configuration Management
- Use environment variables for sensitive credentials
- Implement proper configuration validation
- Separate development and production configurations
- Use ConfigService for centralized configuration management

### Error Handling
- Implement proper exception filters
- Provide meaningful error messages
- Log all payment-related errors
- Handle gateway-specific errors appropriately

### Security
- Validate all input parameters
- Implement rate limiting for payment endpoints
- Use HTTPS for all payment communications
- Sanitize callback data before processing

### Performance
- Implement proper caching strategies
- Use connection pooling for database operations
- Monitor payment gateway response times
- Implement circuit breaker pattern for external calls

### Testing
- Write comprehensive unit tests
- Implement integration tests for payment flows
- Use mock gateways for testing
- Test error scenarios and edge cases

## Troubleshooting

### Common Issues

1. **Gateway Not Found Error**
   ```
   Error: PAYMENTS_GATEWAY provider not found
   ```
   - Ensure PaymentsModule is properly imported
   - Verify gateway configuration is correct

2. **Webhook Not Working**
   ```
   Error: defaultServerListener is not a function
   ```
   - Ensure gateway has `withServer: true` option
   - Verify server host configuration

3. **Payment Creation Fails**
   ```
   Error: Invalid merchant configuration
   ```
   - Check environment variables
   - Verify gateway credentials

4. **Module Import Error**
   ```
   Error: PaymentsModule is not a module
   ```
   - Ensure proper module import syntax
   - Check for circular dependencies

### Debug Mode

```typescript
// Enable debug logging
PaymentsModule.forRoot({
  gateway: new ECPayPayment({
    // ... other config
    debug: true, // Enable debug mode
    logLevel: 'verbose'
  })
})
```

## Changelog

### Version History

- **v0.1.9** - Current version with full NestJS integration
- **v0.1.8** - Added member system integration
- **v0.1.7** - Improved error handling and logging
- **v0.1.6** - Added async configuration support
- **v0.1.5** - Initial stable release

## License

MIT