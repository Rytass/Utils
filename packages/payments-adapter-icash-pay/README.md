# Rytass Utils - Payments Adapter iCash Pay

A comprehensive TypeScript payment adapter for iCash Pay digital payment system. This adapter provides seamless integration with Taiwan's iCash Pay ecosystem, supporting barcode-based payments, digital wallet transactions, and comprehensive payment lifecycle management with advanced security features.

## Features

- [x] iCash Pay barcode-based payment processing
- [x] Multiple payment types (iCash digital wallet, credit card, bank transfer)
- [x] Secure AES encryption and RSA signature verification
- [x] Transaction query and status tracking
- [x] Refund and partial refund operations
- [x] Mobile invoice carrier integration
- [x] Taiwan QR Code (TWQR) support
- [x] Uni Member integration with GID support
- [x] Bonus point and stored value management
- [x] Store-based transaction management
- [x] Production and development environment support
- [x] TypeScript type safety throughout
- [x] Event-driven architecture with payment lifecycle events
- [x] Comprehensive error handling and logging
- [x] Multi-amount transaction support (item, utility, commission amounts)

## Installation

```bash
npm install @rytass/payments-adapter-icash-pay
# or
yarn add @rytass/payments-adapter-icash-pay
```

**Peer Dependencies:**

```bash
npm install @rytass/payments
```

## Configuration

### Security Setup

iCash Pay uses RSA + AES hybrid encryption for secure communication:

```typescript
import { ICashPayPayment, ICashPayBaseUrls, LogLevel } from '@rytass/payments-adapter-icash-pay';

// Production configuration
const productionGateway = new ICashPayPayment({
  baseUrl: ICashPayBaseUrls.PRODUCTION,
  merchantId: 'YOUR_MERCHANT_ID',
  clientPrivateKey: `-----BEGIN PRIVATE KEY-----
  YOUR_CLIENT_PRIVATE_KEY
  -----END PRIVATE KEY-----`,
  serverPublicKey: `-----BEGIN PUBLIC KEY-----
  ICASH_PAY_SERVER_PUBLIC_KEY
  -----END PUBLIC KEY-----`,
  aesKey: {
    id: 'YOUR_AES_KEY_ID',
    key: 'YOUR_32_CHAR_AES_KEY', // 32 characters
    iv: 'YOUR_16_CHAR_AES_IV', // 16 characters
  },
  logLevel: LogLevel.INFO,
});

// Development configuration
const developmentGateway = new ICashPayPayment({
  baseUrl: ICashPayBaseUrls.DEVELOPMENT,
  merchantId: 'TEST_MERCHANT_ID',
  clientPrivateKey: process.env.ICASH_PAY_CLIENT_PRIVATE_KEY!,
  serverPublicKey: process.env.ICASH_PAY_SERVER_PUBLIC_KEY!,
  aesKey: {
    id: process.env.ICASH_PAY_AES_KEY_ID!,
    key: process.env.ICASH_PAY_AES_KEY!,
    iv: process.env.ICASH_PAY_AES_IV!,
  },
  logLevel: LogLevel.DEBUG,
});
```

### Environment-Based Configuration

```typescript
// Secure environment-based setup
const paymentGateway = new ICashPayPayment({
  baseUrl: process.env.NODE_ENV === 'production' ? ICashPayBaseUrls.PRODUCTION : ICashPayBaseUrls.DEVELOPMENT,
  merchantId: process.env.ICASH_PAY_MERCHANT_ID!,
  clientPrivateKey: process.env.ICASH_PAY_CLIENT_PRIVATE_KEY!,
  serverPublicKey: process.env.ICASH_PAY_SERVER_PUBLIC_KEY!,
  aesKey: {
    id: process.env.ICASH_PAY_AES_KEY_ID!,
    key: process.env.ICASH_PAY_AES_KEY!,
    iv: process.env.ICASH_PAY_AES_IV!,
  },
  logLevel: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
});
```

## Basic Usage

### Simple Barcode Payment

```typescript
import { ICashPayPayment, ICashPayPaymentType } from '@rytass/payments-adapter-icash-pay';
import { PaymentEvents } from '@rytass/payments';

const paymentGateway = new ICashPayPayment({
  baseUrl: ICashPayBaseUrls.PRODUCTION,
  merchantId: process.env.ICASH_PAY_MERCHANT_ID!,
  clientPrivateKey: process.env.ICASH_PAY_CLIENT_PRIVATE_KEY!,
  serverPublicKey: process.env.ICASH_PAY_SERVER_PUBLIC_KEY!,
  aesKey: {
    id: process.env.ICASH_PAY_AES_KEY_ID!,
    key: process.env.ICASH_PAY_AES_KEY!,
    iv: process.env.ICASH_PAY_AES_IV!,
  },
});

// Setup payment event listeners
paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, message => {
  console.log('iCash Pay payment successful:', message.id);
  console.log('Transaction ID:', message.transactionId);
  console.log('Payment Type:', message.paymentType);
  console.log('Amount Paid:', message.totalPrice);
});

// Create barcode payment order
const order = await paymentGateway.prepare({
  id: 'ORDER-2024-001',
  storeName: 'My Coffee Shop',
  storeId: 'STORE001', // Optional store identifier
  barcode: '280012345678901234', // Customer's iCash Pay barcode
  amount: 150, // Total transaction amount
  items: [
    {
      name: 'Americano Coffee',
      unitPrice: 120,
      quantity: 1,
    },
    {
      name: 'Service Fee',
      unitPrice: 30,
      quantity: 1,
    },
  ],
});

console.log('Order ID:', order.id);
console.log('Total Amount:', order.totalPrice);
console.log('Store Name:', order.storeName);

// Process the payment
const commitResult = await order.commit();
if (commitResult.success) {
  console.log('Payment processed successfully');
  console.log('Transaction ID:', order.transactionId);
  console.log('iCP Account:', order.icpAccount);
} else {
  console.error('Payment failed:', commitResult.error);
}
```

### Multi-Amount Transaction

iCash Pay supports different amount categories for complex business scenarios:

```typescript
// Complex transaction with multiple amount types
const complexOrder = await paymentGateway.prepare({
  id: 'COMPLEX-ORDER-001',
  storeName: 'Department Store',
  storeId: 'DS001',
  barcode: '280012345678901234',
  amount: 1000, // Total amount
  collectedAmount: 800, // Amount collected by store
  consignmentAmount: 200, // Consignment amount
  nonRedeemAmount: 100, // Non-redeemable amount
  collectedNonRedeemAmount: 80, // Collected non-redeemable amount
  consignmentNonRedeemAmount: 20, // Consignment non-redeemable amount
  nonPointAmount: 50, // Amount not earning points
  items: [
    {
      name: 'Premium Product',
      unitPrice: 800,
      quantity: 1,
    },
    {
      name: 'Consignment Item',
      unitPrice: 200,
      quantity: 1,
    },
  ],
});
```

### Payment Query

```typescript
// Query payment status
const paymentStatus = await paymentGateway.query('ORDER-2024-001');

console.log('Order ID:', paymentStatus.id);
console.log('Transaction ID:', paymentStatus.transactionId);
console.log('Trade Status:', paymentStatus.tradeStatus);
console.log('Payment Type:', paymentStatus.paymentType);
console.log('iCP Account:', paymentStatus.icpAccount);
console.log('Paid Amount:', paymentStatus.paidAmount);
console.log('Bonus Amount:', paymentStatus.bonusAmount);

// Check if payment is completed
if (paymentStatus.isCommitted) {
  console.log('Payment completed at:', paymentStatus.committedAt);
} else if (paymentStatus.isFailed) {
  console.log('Payment failed:', paymentStatus.failedMessage);
}
```

## Advanced Usage

### Mobile Invoice Integration

```typescript
// Payment with mobile invoice carrier
const invoiceOrder = await paymentGateway.prepare({
  id: 'INVOICE-ORDER-001',
  storeName: 'Electronic Store',
  barcode: '280012345678901234',
  amount: 5000,
  items: [
    {
      name: 'Smartphone',
      unitPrice: 5000,
      quantity: 1,
      mobileInvoiceCarrier: '/ABC12345', // Customer's mobile carrier barcode
    },
  ],
});

// After payment, check invoice information
const result = await invoiceOrder.commit();
if (result.success) {
  console.log('Mobile Invoice Carrier:', invoiceOrder.invoiceMobileCarrier);
  console.log('TWQR Code:', invoiceOrder.isTWQRCode);
  console.log('TWQR Issue Code:', invoiceOrder.twqrIssueCode);
}
```

### Member Integration

```typescript
// Payment with member integration
const memberOrder = await paymentGateway.prepare({
  id: 'MEMBER-ORDER-001',
  storeName: 'Loyalty Store',
  barcode: '280012345678901234',
  amount: 300,
  items: [
    {
      name: 'Member Special Item',
      unitPrice: 300,
      quantity: 1,
      memberGID: 'UNI_MEMBER_123456', // Uni Member ID
      boundMemberId: 'STORE_MEMBER_789', // Store's member system ID
    },
  ],
});

// Check member information after payment
const memberResult = await memberOrder.commit();
if (memberResult.success) {
  console.log('Bound Member ID:', memberOrder.boundMemberId);
  console.log('Uni GID:', memberOrder.uniGID);
}
```

### Credit Card Payment Tracking

```typescript
// For credit card payments, track card information
const creditOrder = await paymentGateway.prepare({
  id: 'CREDIT-ORDER-001',
  storeName: 'Online Store',
  barcode: '280012345678901234',
  amount: 2500,
  items: [
    {
      name: 'Online Purchase',
      unitPrice: 2500,
      quantity: 1,
    },
  ],
});

const creditResult = await creditOrder.commit();
if (creditResult.success && creditOrder.paymentType === ICashPayPaymentType.CREDIT_CARD) {
  console.log('Credit Card Payment');
  console.log('Card First 6:', creditOrder.creditCardFirstSix);
  console.log('Card Last 4:', creditOrder.creditCardLastFour);
  console.log('Masked PAN:', creditOrder.maskedPan);
}
```

### Transaction Refund

```typescript
// Full refund
const fullRefund = await paymentGateway.refund({
  id: 'ORDER-2024-001',
  storeName: 'My Coffee Shop',
  transactionId: 'TXN123456789',
  requestRefundAmount: 150, // Full amount
});

if (fullRefund.success) {
  console.log('Full refund processed');
  console.log('Refund Transaction ID:', fullRefund.transactionId);
  console.log('Refunded Amount:', fullRefund.refundedAmount);
}

// Partial refund with detailed amounts
const partialRefund = await paymentGateway.refund({
  id: 'COMPLEX-ORDER-001',
  storeId: 'DS001',
  storeName: 'Department Store',
  transactionId: 'TXN987654321',
  requestRefundAmount: 500, // Total refund amount
  requestRefundCollectedAmount: 400, // Collected amount to refund
  requestRefundConsignmentAmount: 100, // Consignment amount to refund
  refundOrderId: 'REFUND-001', // Optional refund order ID
});

if (partialRefund.success) {
  console.log('Partial refund processed');
  console.log('Original Amount:', partialRefund.originalAmount);
  console.log('Refunded iCP Amount:', partialRefund.refundedICPAmount);
  console.log('Refunded Bonus Amount:', partialRefund.refundedBonusAmount);
}
```

## Payment Types

### Supported Payment Methods

```typescript
import { ICashPayPaymentType } from '@rytass/payments-adapter-icash-pay';

// Available payment types
const paymentTypes = {
  CREDIT_CARD: ICashPayPaymentType.CREDIT_CARD, // '0' - Credit card payments
  I_CASH: ICashPayPaymentType.I_CASH, // '1' - iCash digital wallet
  BANK: ICashPayPaymentType.BANK, // '2' - Bank transfer
};

// Check payment type after transaction
const checkPaymentType = (order: ICashPayOrder) => {
  switch (order.paymentType) {
    case ICashPayPaymentType.CREDIT_CARD:
      console.log('Payment via credit card');
      console.log('Card info:', order.creditCardFirstSix, '****', order.creditCardLastFour);
      break;
    case ICashPayPaymentType.I_CASH:
      console.log('Payment via iCash digital wallet');
      console.log('iCP Account:', order.icpAccount);
      break;
    case ICashPayPaymentType.BANK:
      console.log('Payment via bank transfer');
      break;
  }
};
```

### Trade Status Management

```typescript
import { ICashPayTradeStatus } from '@rytass/payments-adapter-icash-pay';

// Trade status types
const tradeStatuses = {
  INITED: ICashPayTradeStatus.INITED, // '0' - Transaction initiated
  COMMITTED: ICashPayTradeStatus.COMMITTED, // '1' - Transaction completed
  REFUNDED: ICashPayTradeStatus.REFUNDED, // '2' - Fully refunded
  PARTIAL_REFUNDED: ICashPayTradeStatus.PARTIAL_REFUNDED, // '3' - Partially refunded
  CANCELLED: ICashPayTradeStatus.CANCELLED, // '4' - Transaction cancelled
  WAITING_SETTLEMENT: ICashPayTradeStatus.WAITING_SETTLEMENT, // '5' - Waiting for settlement
  SETTLEMENT_FAILED: ICashPayTradeStatus.SETTLEMENT_FAILED, // '6' - Settlement failed
  FAILED: ICashPayTradeStatus.FAILED, // '7' - Transaction failed
};

// Handle different trade statuses
const handleTradeStatus = (order: ICashPayOrder) => {
  switch (order.tradeStatus) {
    case ICashPayTradeStatus.COMMITTED:
      console.log('Payment successful and completed');
      break;
    case ICashPayTradeStatus.WAITING_SETTLEMENT:
      console.log('Payment pending settlement');
      break;
    case ICashPayTradeStatus.FAILED:
      console.log('Payment failed:', order.failedMessage);
      break;
    case ICashPayTradeStatus.REFUNDED:
      console.log('Payment has been refunded');
      break;
  }
};
```

## Integration Examples

### Express.js API Integration

```typescript
import express from 'express';
import { ICashPayPayment, ICashPayBaseUrls, ICashPayPaymentType } from '@rytass/payments-adapter-icash-pay';
import { PaymentEvents } from '@rytass/payments';

const app = express();
app.use(express.json());

const paymentGateway = new ICashPayPayment({
  baseUrl: process.env.NODE_ENV === 'production' ? ICashPayBaseUrls.PRODUCTION : ICashPayBaseUrls.DEVELOPMENT,
  merchantId: process.env.ICASH_PAY_MERCHANT_ID!,
  clientPrivateKey: process.env.ICASH_PAY_CLIENT_PRIVATE_KEY!,
  serverPublicKey: process.env.ICASH_PAY_SERVER_PUBLIC_KEY!,
  aesKey: {
    id: process.env.ICASH_PAY_AES_KEY_ID!,
    key: process.env.ICASH_PAY_AES_KEY!,
    iv: process.env.ICASH_PAY_AES_IV!,
  },
});

// Handle payment success
paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, async message => {
  // Update database
  await updateOrderStatus(message.id, 'paid');

  // Send confirmation
  await sendPaymentConfirmation(message.id, {
    transactionId: message.transactionId,
    paymentType: message.paymentType,
    paidAmount: message.totalPrice,
  });

  console.log(`iCash Pay payment committed: ${message.id}`);
});

// Create payment endpoint
app.post('/api/payments/icash-pay', async (req, res) => {
  try {
    const { orderId, storeName, storeId, barcode, items, amounts, memberInfo } = req.body;

    const order = await paymentGateway.prepare({
      id: orderId,
      storeName,
      storeId,
      barcode,
      amount: amounts.total,
      collectedAmount: amounts.collected,
      consignmentAmount: amounts.consignment,
      nonRedeemAmount: amounts.nonRedeem,
      nonPointAmount: amounts.nonPoint,
      items: items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        memberGID: memberInfo?.uniGID,
        boundMemberId: memberInfo?.storeMemberId,
        mobileInvoiceCarrier: item.invoiceCarrier,
      })),
    });

    // Process payment
    const result = await order.commit();

    if (result.success) {
      res.json({
        success: true,
        payment: {
          orderId: order.id,
          transactionId: order.transactionId,
          paymentType: order.paymentType,
          icpAccount: order.icpAccount,
          paidAmount: order.paidAmount,
          bonusAmount: order.bonusAmount,
          committedAt: order.committedAt,
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

// Query payment status endpoint
app.get('/api/payments/icash-pay/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await paymentGateway.query(orderId);

    res.json({
      success: true,
      payment: {
        orderId: order.id,
        transactionId: order.transactionId,
        tradeStatus: order.tradeStatus,
        paymentType: order.paymentType,
        icpAccount: order.icpAccount,
        paidAmount: order.paidAmount,
        bonusAmount: order.bonusAmount,
        isCommitted: order.isCommitted,
        isFailed: order.isFailed,
        isRefunded: order.isRefunded,
        committedAt: order.committedAt,
        failedMessage: order.failedMessage,
      },
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Payment not found',
    });
  }
});

// Refund endpoint
app.post('/api/payments/icash-pay/:orderId/refund', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { storeName, storeId, refundAmount, refundCollectedAmount, refundConsignmentAmount, refundOrderId } =
      req.body;

    // Get original order to obtain transaction ID
    const originalOrder = await paymentGateway.query(orderId);

    if (!originalOrder.transactionId) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID not found for this order',
      });
    }

    const refundResult = await paymentGateway.refund({
      id: orderId,
      storeName,
      storeId,
      transactionId: originalOrder.transactionId,
      requestRefundAmount: refundAmount,
      requestRefundCollectedAmount: refundCollectedAmount,
      requestRefundConsignmentAmount: refundConsignmentAmount,
      refundOrderId,
    });

    if (refundResult.success) {
      res.json({
        success: true,
        refund: {
          orderId,
          refundTransactionId: refundResult.transactionId,
          refundedAmount: refundResult.refundedAmount,
          refundedICPAmount: refundResult.refundedICPAmount,
          refundedBonusAmount: refundResult.refundedBonusAmount,
          originalAmount: refundResult.originalAmount,
          processedAt: refundResult.processedAt,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: refundResult.error,
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
  console.log('iCash Pay payment server running on port 3000');
});
```

### NestJS Service Integration

```typescript
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import {
  ICashPayPayment,
  ICashPayBaseUrls,
  ICashPayPaymentType,
  ICashPayTradeStatus,
} from '@rytass/payments-adapter-icash-pay';
import { PaymentEvents, OrderState } from '@rytass/payments';

@Injectable()
export class ICashPayService {
  private readonly logger = new Logger(ICashPayService.name);
  private readonly paymentGateway: ICashPayPayment;

  constructor() {
    this.paymentGateway = new ICashPayPayment({
      baseUrl: process.env.NODE_ENV === 'production' ? ICashPayBaseUrls.PRODUCTION : ICashPayBaseUrls.DEVELOPMENT,
      merchantId: process.env.ICASH_PAY_MERCHANT_ID!,
      clientPrivateKey: process.env.ICASH_PAY_CLIENT_PRIVATE_KEY!,
      serverPublicKey: process.env.ICASH_PAY_SERVER_PUBLIC_KEY!,
      aesKey: {
        id: process.env.ICASH_PAY_AES_KEY_ID!,
        key: process.env.ICASH_PAY_AES_KEY!,
        iv: process.env.ICASH_PAY_AES_IV!,
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, message => {
      this.logger.log(`iCash Pay payment committed: ${message.id}`);
      this.handlePaymentSuccess(message);
    });

    this.paymentGateway.emitter.on(PaymentEvents.ORDER_FAILED, failure => {
      this.logger.error(`iCash Pay payment failed: ${failure.code} - ${failure.message}`);
      this.handlePaymentFailure(failure);
    });
  }

  async createPayment(paymentData: {
    orderId?: string;
    storeName: string;
    storeId?: string;
    barcode: string;
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      invoiceCarrier?: string;
    }>;
    amounts?: {
      total: number;
      collected?: number;
      consignment?: number;
      nonRedeem?: number;
      nonPoint?: number;
    };
    memberInfo?: {
      uniGID?: string;
      storeMemberId?: string;
    };
  }) {
    // Validate barcode format
    if (!/^\d{18}$/.test(paymentData.barcode)) {
      throw new BadRequestException('Invalid iCash Pay barcode format');
    }

    const totalAmount =
      paymentData.amounts?.total || paymentData.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Create order
    const order = await this.paymentGateway.prepare({
      id: paymentData.orderId,
      storeName: paymentData.storeName,
      storeId: paymentData.storeId,
      barcode: paymentData.barcode,
      amount: totalAmount,
      collectedAmount: paymentData.amounts?.collected,
      consignmentAmount: paymentData.amounts?.consignment,
      nonRedeemAmount: paymentData.amounts?.nonRedeem,
      nonPointAmount: paymentData.amounts?.nonPoint,
      items: paymentData.items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        mobileInvoiceCarrier: item.invoiceCarrier,
        memberGID: paymentData.memberInfo?.uniGID,
        boundMemberId: paymentData.memberInfo?.storeMemberId,
      })),
    });

    // Process payment
    const result = await order.commit();

    if (!result.success) {
      throw new BadRequestException(`Payment failed: ${result.error}`);
    }

    return {
      orderId: order.id,
      transactionId: order.transactionId,
      paymentType: this.getPaymentTypeString(order.paymentType),
      icpAccount: order.icpAccount,
      paidAmount: order.paidAmount,
      bonusAmount: order.bonusAmount,
      state: order.state,
      committedAt: order.committedAt,
      memberInfo: {
        boundMemberId: order.boundMemberId,
        uniGID: order.uniGID,
      },
      invoiceInfo: {
        mobileCarrier: order.invoiceMobileCarrier,
        isTWQRCode: order.isTWQRCode,
        twqrIssueCode: order.twqrIssueCode,
      },
    };
  }

  async getPaymentStatus(orderId: string) {
    try {
      const order = await this.paymentGateway.query(orderId);

      return {
        orderId: order.id,
        transactionId: order.transactionId,
        tradeStatus: this.getTradeStatusString(order.tradeStatus),
        paymentType: this.getPaymentTypeString(order.paymentType),
        icpAccount: order.icpAccount,
        paidAmount: order.paidAmount,
        bonusAmount: order.bonusAmount,
        isCommitted: order.isCommitted,
        isFailed: order.isFailed,
        isRefunded: order.isRefunded,
        state: order.state,
        createdAt: order.createdAt,
        committedAt: order.committedAt,
        failedMessage: order.failedMessage,
      };
    } catch (error) {
      throw new NotFoundException(`Payment ${orderId} not found`);
    }
  }

  async refundPayment(
    orderId: string,
    refundData: {
      storeName: string;
      storeId?: string;
      refundAmount: number;
      refundCollectedAmount?: number;
      refundConsignmentAmount?: number;
      refundOrderId?: string;
    },
  ) {
    // Get original order
    const originalOrder = await this.getPaymentStatus(orderId);

    if (!originalOrder.isCommitted) {
      throw new BadRequestException('Can only refund committed payments');
    }

    if (originalOrder.isRefunded) {
      throw new BadRequestException('Payment has already been refunded');
    }

    const refundResult = await this.paymentGateway.refund({
      id: orderId,
      storeName: refundData.storeName,
      storeId: refundData.storeId,
      transactionId: originalOrder.transactionId,
      requestRefundAmount: refundData.refundAmount,
      requestRefundCollectedAmount: refundData.refundCollectedAmount,
      requestRefundConsignmentAmount: refundData.refundConsignmentAmount,
      refundOrderId: refundData.refundOrderId,
    });

    if (!refundResult.success) {
      throw new BadRequestException(`Refund failed: ${refundResult.error}`);
    }

    return {
      orderId,
      refundTransactionId: refundResult.transactionId,
      refundedAmount: refundResult.refundedAmount,
      refundedICPAmount: refundResult.refundedICPAmount,
      refundedBonusAmount: refundResult.refundedBonusAmount,
      originalAmount: refundResult.originalAmount,
      processedAt: refundResult.processedAt,
    };
  }

  private getPaymentTypeString(paymentType?: ICashPayPaymentType): string {
    switch (paymentType) {
      case ICashPayPaymentType.CREDIT_CARD:
        return 'credit_card';
      case ICashPayPaymentType.I_CASH:
        return 'icash_wallet';
      case ICashPayPaymentType.BANK:
        return 'bank_transfer';
      default:
        return 'unknown';
    }
  }

  private getTradeStatusString(tradeStatus?: ICashPayTradeStatus): string {
    switch (tradeStatus) {
      case ICashPayTradeStatus.INITED:
        return 'initiated';
      case ICashPayTradeStatus.COMMITTED:
        return 'committed';
      case ICashPayTradeStatus.REFUNDED:
        return 'refunded';
      case ICashPayTradeStatus.PARTIAL_REFUNDED:
        return 'partial_refunded';
      case ICashPayTradeStatus.CANCELLED:
        return 'cancelled';
      case ICashPayTradeStatus.WAITING_SETTLEMENT:
        return 'waiting_settlement';
      case ICashPayTradeStatus.SETTLEMENT_FAILED:
        return 'settlement_failed';
      case ICashPayTradeStatus.FAILED:
        return 'failed';
      default:
        return 'unknown';
    }
  }

  private async handlePaymentSuccess(message: any) {
    // Handle successful payment - update database, send notifications, etc.
    this.logger.log(`Processing payment success for order: ${message.id}`);
  }

  private async handlePaymentFailure(failure: any) {
    // Handle payment failure - log, notify customer, etc.
    this.logger.error(`Processing payment failure: ${failure.code} - ${failure.message}`);
  }
}
```

### React Payment Scanner Component

```typescript
import React, { useState, useRef, useEffect } from 'react';

interface ICashPayScannerProps {
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  storeName: string;
  storeId?: string;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
}

const ICashPayScanner: React.FC<ICashPayScannerProps> = ({
  items,
  storeName,
  storeId,
  onSuccess,
  onError
}) => {
  const [barcode, setBarcode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [memberInfo, setMemberInfo] = useState({
    uniGID: '',
    storeMemberId: ''
  });
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const validateBarcode = (code: string): boolean => {
    return /^\d{18}$/.test(code); // 18-digit barcode
  };

  const processPayment = async () => {
    if (!validateBarcode(barcode)) {
      onError('Please scan a valid 18-digit iCash Pay barcode');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/payments/icash-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName,
          storeId,
          barcode,
          items,
          amounts: {
            total: totalAmount
          },
          memberInfo: {
            uniGID: memberInfo.uniGID || undefined,
            storeMemberId: memberInfo.storeMemberId || undefined
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(data.payment);
        // Reset form
        setBarcode('');
        setMemberInfo({ uniGID: '', storeMemberId: '' });
      } else {
        onError(data.error);
      }
    } catch (error) {
      onError('Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 18);
    setBarcode(value);

    // Auto-process when 18 digits are entered
    if (value.length === 18) {
      setTimeout(() => processPayment(), 100);
    }
  };

  useEffect(() => {
    // Focus on barcode input when component mounts
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  return (
    <div className="icash-pay-scanner">
      <h3>iCash Pay Scanner</h3>

      <div className="order-summary">
        <h4>Order Summary</h4>
        <div className="store-info">
          <p><strong>Store:</strong> {storeName}</p>
          {storeId && <p><strong>Store ID:</strong> {storeId}</p>}
        </div>

        <div className="items">
          {items.map((item, index) => (
            <div key={index} className="item">
              <span>{item.name}</span>
              <span>{item.quantity} x NT${item.price}</span>
            </div>
          ))}
        </div>

        <div className="total">
          <strong>Total: NT${totalAmount}</strong>
        </div>
      </div>

      <div className="scanner-section">
        <div className="barcode-input">
          <label>Scan iCash Pay Barcode:</label>
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcode}
            onChange={handleBarcodeInput}
            placeholder="Scan or enter 18-digit barcode"
            maxLength={18}
            disabled={isProcessing}
            className="barcode-field"
          />
          <div className="barcode-format">
            Format: {barcode.replace(/(\d{3})(\d{4})(\d{4})(\d{4})(\d{3})/, '$1 $2 $3 $4 $5')}
          </div>
        </div>

        <div className="member-section">
          <h5>Member Information (Optional)</h5>
          <div className="member-inputs">
            <input
              type="text"
              placeholder="Uni Member GID"
              value={memberInfo.uniGID}
              onChange={(e) => setMemberInfo(prev => ({ ...prev, uniGID: e.target.value }))}
              disabled={isProcessing}
            />
            <input
              type="text"
              placeholder="Store Member ID"
              value={memberInfo.storeMemberId}
              onChange={(e) => setMemberInfo(prev => ({ ...prev, storeMemberId: e.target.value }))}
              disabled={isProcessing}
            />
          </div>
        </div>

        <div className="action-buttons">
          <button
            onClick={processPayment}
            disabled={!validateBarcode(barcode) || isProcessing}
            className="process-btn"
          >
            {isProcessing ? 'Processing...' : 'Process Payment'}
          </button>

          <button
            onClick={() => {
              setBarcode('');
              if (barcodeInputRef.current) {
                barcodeInputRef.current.focus();
              }
            }}
            disabled={isProcessing}
            className="clear-btn"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="payment-info">
        <h5>Payment Information</h5>
        <ul>
          <li>iCash Pay supports digital wallet, credit card, and bank transfer</li>
          <li>Customer will receive bonus points for eligible transactions</li>
          <li>Mobile invoice carriers are automatically detected</li>
          <li>Transaction is processed in real-time</li>
        </ul>
      </div>
    </div>
  );
};

export default ICashPayScanner;
```

## Error Handling

### Common Error Scenarios

```typescript
try {
  const order = await paymentGateway.prepare({
    storeName: 'Test Store',
    barcode: '280012345678901234',
    amount: 1000,
    items: [
      /* items */
    ],
  });

  const result = await order.commit();
} catch (error) {
  // Handle different types of errors
  if (error.message.includes('Invalid barcode format')) {
    console.error('Barcode format is incorrect - must be 18 digits');
  } else if (error.message.includes('Insufficient balance')) {
    console.error('Customer does not have sufficient iCash Pay balance');
  } else if (error.message.includes('Merchant not authorized')) {
    console.error('Merchant credentials are invalid or expired');
  } else if (error.message.includes('Transaction limit exceeded')) {
    console.error('Transaction amount exceeds daily or single transaction limit');
  } else if (error.message.includes('Network timeout')) {
    console.error('Connection to iCash Pay service timed out');
  } else if (error.message.includes('Encryption error')) {
    console.error('AES/RSA encryption/decryption failed');
  } else {
    console.error('Unexpected payment error:', error.message);
  }
}

// Query errors
try {
  const order = await paymentGateway.query('NON_EXISTENT_ORDER');
} catch (error) {
  if (error.message.includes('Order not found')) {
    console.error('No payment found with this order ID');
  } else if (error.message.includes('Invalid response')) {
    console.error('Received invalid response from iCash Pay API');
  }
}

// Refund errors
try {
  await paymentGateway.refund({
    id: 'ORDER-001',
    storeName: 'Test Store',
    transactionId: 'TXN123',
    requestRefundAmount: 1000,
  });
} catch (error) {
  if (error.message.includes('Transaction not found')) {
    console.error('Original transaction not found for refund');
  } else if (error.message.includes('Refund amount exceeds')) {
    console.error('Refund amount is greater than original payment amount');
  } else if (error.message.includes('Already refunded')) {
    console.error('This transaction has already been refunded');
  }
}
```

### Validation Helpers

```typescript
// Barcode validation
const validateICashPayBarcode = (barcode: string): boolean => {
  return /^\d{18}$/.test(barcode);
};

// Amount validation
const validateAmounts = (amounts: { total: number; collected?: number; consignment?: number; nonRedeem?: number }) => {
  if (amounts.total <= 0) {
    throw new Error('Total amount must be greater than 0');
  }

  const calculatedTotal = (amounts.collected || 0) + (amounts.consignment || 0);
  if (calculatedTotal > 0 && calculatedTotal !== amounts.total) {
    throw new Error('Collected + Consignment amounts must equal total amount');
  }

  if (amounts.nonRedeem && amounts.nonRedeem > amounts.total) {
    throw new Error('Non-redeemable amount cannot exceed total amount');
  }
};

// Safe payment processing
const processPaymentSafely = async (paymentData: any) => {
  try {
    // Validate inputs
    if (!validateICashPayBarcode(paymentData.barcode)) {
      throw new Error('Invalid iCash Pay barcode format');
    }

    validateAmounts(paymentData.amounts);

    // Process payment
    const order = await paymentGateway.prepare(paymentData);
    const result = await order.commit();

    if (result.success) {
      return { success: true, order };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Payment processing error:', error);
    return { success: false, error: error.message };
  }
};
```

## Security

### Encryption and Signing

iCash Pay uses RSA + AES hybrid encryption:

```typescript
// Example key generation (for development)
const crypto = require('crypto');

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

// Generate AES key and IV
const aesKey = crypto.randomBytes(32).toString('hex'); // 32 bytes = 256 bits
const aesIV = crypto.randomBytes(16).toString('hex'); // 16 bytes = 128 bits

console.log('Client Private Key:', privateKey);
console.log('AES Key:', aesKey);
console.log('AES IV:', aesIV);
```

### Best Practices

- Store private keys securely and never expose them in client-side code
- Use different key sets for development and production environments
- Implement proper key rotation procedures
- Validate all encrypted responses before processing
- Log security events for audit purposes
- Use HTTPS for all API communications

## Testing

```typescript
import { ICashPayPayment, ICashPayBaseUrls, ICashPayPaymentType } from '@rytass/payments-adapter-icash-pay';
import { OrderState } from '@rytass/payments';

describe('iCash Pay Payment Integration', () => {
  let paymentGateway: ICashPayPayment;

  beforeEach(() => {
    paymentGateway = new ICashPayPayment({
      baseUrl: ICashPayBaseUrls.DEVELOPMENT,
      merchantId: 'TEST_MERCHANT',
      clientPrivateKey: process.env.TEST_CLIENT_PRIVATE_KEY!,
      serverPublicKey: process.env.TEST_SERVER_PUBLIC_KEY!,
      aesKey: {
        id: 'TEST_KEY_ID',
        key: 'TEST_AES_KEY_32_CHARACTERS_LONG',
        iv: 'TEST_AES_IV_16C',
      },
    });
  });

  it('should create order successfully', async () => {
    const order = await paymentGateway.prepare({
      storeName: 'Test Store',
      barcode: '280012345678901234',
      amount: 1000,
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
    expect(order.storeName).toBe('Test Store');
    expect(order.state).toBe(OrderState.PRE_COMMIT);
  });

  it('should process payment successfully', async () => {
    const order = await paymentGateway.prepare({
      storeName: 'Test Store',
      barcode: '280012345678901234',
      amount: 500,
      items: [
        {
          name: 'Test Item',
          unitPrice: 500,
          quantity: 1,
        },
      ],
    });

    const result = await order.commit();

    expect(result.success).toBe(true);
    expect(order.state).toBe(OrderState.COMMITTED);
    expect(order.transactionId).toBeDefined();
    expect(order.committedAt).toBeDefined();
  });

  it('should query payment status', async () => {
    const order = await paymentGateway.query('TEST-ORDER-001');

    expect(order.id).toBe('TEST-ORDER-001');
    expect(order.transactionId).toBeDefined();
    expect(order.tradeStatus).toBeDefined();
  });

  it('should handle refunds', async () => {
    const refundResult = await paymentGateway.refund({
      id: 'TEST-ORDER-001',
      storeName: 'Test Store',
      transactionId: 'TEST-TXN-001',
      requestRefundAmount: 500,
    });

    expect(refundResult.success).toBe(true);
    expect(refundResult.refundedAmount).toBe(500);
    expect(refundResult.transactionId).toBeDefined();
  });

  it('should validate barcode format', () => {
    const validBarcode = '280012345678901234';
    const invalidBarcode = '123456789';

    expect(validateICashPayBarcode(validBarcode)).toBe(true);
    expect(validateICashPayBarcode(invalidBarcode)).toBe(false);
  });
});
```

## API Reference

### ICashPayPayment Constructor Options

```typescript
interface ICashPayPaymentInitOptions {
  baseUrl: ICashPayBaseUrls; // Required: API endpoint URL
  merchantId: string; // Required: iCash Pay merchant ID
  clientPrivateKey: string; // Required: RSA private key for signing
  serverPublicKey: string; // Required: iCash Pay server public key
  aesKey: ICashPayAESKey; // Required: AES encryption configuration
  logLevel?: LogLevel; // Optional: Logging level
}

interface ICashPayAESKey {
  id: string; // AES key identifier
  key: string; // 32-character AES key
  iv: string; // 16-character AES IV
}
```

### ICashPayPayment Methods

#### `prepare(options: ICashPayPrepareOptions): Promise<ICashPayOrder>`

Creates a new iCash Pay payment order.

**Parameters:**

- `storeName: string` - Store name for display
- `barcode: string` - Customer's 18-digit iCash Pay barcode
- `amount: number` - Total transaction amount
- `items: ICashPayOrderItem[]` - Order line items
- `id?: string` - Optional order ID (auto-generated if not provided)
- `storeId?: string` - Store identifier
- `collectedAmount?: number` - Amount collected by store
- `consignmentAmount?: number` - Consignment amount
- `nonRedeemAmount?: number` - Non-redeemable amount
- `nonPointAmount?: number` - Amount not earning points

#### `query(orderId: string): Promise<ICashPayOrder>`

Queries payment status by order ID.

**Parameters:**

- `orderId: string` - Order identifier

#### `refund(options: ICashPayRefundOptions): Promise<ICashPayRefundResult>`

Refunds an iCash Pay transaction.

**Parameters:**

- `id: string` - Original order ID
- `storeName: string` - Store name
- `transactionId: string` - Original transaction ID
- `requestRefundAmount: number` - Amount to refund
- `storeId?: string` - Store identifier
- `requestRefundCollectedAmount?: number` - Collected amount to refund
- `requestRefundConsignmentAmount?: number` - Consignment amount to refund
- `refundOrderId?: string` - Refund order identifier

### Constants and Enums

```typescript
// API endpoints
enum ICashPayBaseUrls {
  PRODUCTION = 'https://payment.icashpay.com.tw/api/V2/Payment',
  DEVELOPMENT = 'https://icp-payment-preprod.icashpay.com.tw/api/V2/Payment',
}

// Payment types
enum ICashPayPaymentType {
  CREDIT_CARD = '0', // Credit card payments
  I_CASH = '1', // iCash digital wallet
  BANK = '2', // Bank transfer
}

// Trade statuses
enum ICashPayTradeStatus {
  INITED = '0', // Transaction initiated
  COMMITTED = '1', // Transaction completed
  REFUNDED = '2', // Fully refunded
  PARTIAL_REFUNDED = '3', // Partially refunded
  CANCELLED = '4', // Transaction cancelled
  WAITING_SETTLEMENT = '5', // Waiting for settlement
  SETTLEMENT_FAILED = '6', // Settlement failed
  FAILED = '7', // Transaction failed
}

// Log levels
enum LogLevel {
  ERROR = 1, // Error messages only
  INFO = 2, // Info and error messages
  DEBUG = 4, // All messages including debug
}
```

## License

MIT
