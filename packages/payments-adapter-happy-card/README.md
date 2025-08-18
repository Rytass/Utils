# Rytass Utils - Payments Adapter Happy Card

A comprehensive TypeScript payment adapter for Uni Happy Card (統一集團禮物卡) gift card payment system. This adapter provides seamless integration with Taiwan's Happy Card ecosystem, supporting gift card payments, point management, and bonus redemption functionality.

## Features

- [x] Happy Card gift card payment processing
- [x] Card balance and bonus point inquiry
- [x] Multiple payment types (amount and bonus points)
- [x] Gift card product type support (GF/GS series)
- [x] Card serial number validation and verification
- [x] Automatic transaction verification with MD5 checksum
- [x] Refund and reversal operations
- [x] Island region support (離島地區)
- [x] Member integration with Uni Member GID
- [x] Own cup discount support (自帶杯優惠)
- [x] Record-based usage tracking
- [x] Production and development environment support
- [x] TypeScript type safety throughout
- [x] Event-driven architecture
- [x] Comprehensive error handling

## Installation

```bash
npm install @rytass/payments-adapter-happy-card
# or
yarn add @rytass/payments-adapter-happy-card
```

**Peer Dependencies:**
```bash
npm install @rytass/payments
```

## Configuration

### Basic Setup

```typescript
import { HappyCardPayment, HappyCardBaseUrls } from '@rytass/payments-adapter-happy-card';

// Production environment
const productionGateway = new HappyCardPayment({
  cSource: 'YOUR_C_SOURCE',           // Happy Card provided source identifier
  key: 'YOUR_SECRET_KEY',             // Happy Card provided secret key
  posId: '01',                        // POS terminal ID (optional, defaults to '01')
  baseUrl: HappyCardBaseUrls.PRODUCTION // Production API endpoint
});

// Development environment
const developmentGateway = new HappyCardPayment({
  cSource: 'TEST_C_SOURCE',
  key: 'TEST_SECRET_KEY',
  baseUrl: HappyCardBaseUrls.DEVELOPMENT // UAT/Testing API endpoint
});
```

### Environment-Specific Configuration

```typescript
// Environment-based configuration
const paymentGateway = new HappyCardPayment({
  cSource: process.env.HAPPY_CARD_C_SOURCE!,
  key: process.env.HAPPY_CARD_SECRET_KEY!,
  posId: process.env.HAPPY_CARD_POS_ID || '01',
  baseUrl: process.env.NODE_ENV === 'production' 
    ? HappyCardBaseUrls.PRODUCTION 
    : HappyCardBaseUrls.DEVELOPMENT
});
```

## Basic Usage

### Simple Gift Card Payment

```typescript
import { 
  HappyCardPayment, 
  HappyCardRecordType, 
  HappyCardOrderItem 
} from '@rytass/payments-adapter-happy-card';
import { PaymentEvents } from '@rytass/payments';

const paymentGateway = new HappyCardPayment({
  cSource: process.env.HAPPY_CARD_C_SOURCE!,
  key: process.env.HAPPY_CARD_SECRET_KEY!,
  baseUrl: HappyCardBaseUrls.PRODUCTION
});

// Setup payment event listeners
paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, (message) => {
  console.log('Happy Card payment successful:', message.id);
  console.log('Total amount charged:', message.totalPrice);
});

// Create order with Happy Card payment
const order = await paymentGateway.prepare({
  id: 'ORDER-2024-001',
  cardSerial: 'HC1234567890123456',    // 16-digit Happy Card number
  type: HappyCardRecordType.BONUS,     // Pay with bonus points
  items: [
    {
      name: 'Coffee',
      unitPrice: 150,
      quantity: 2
    },
    {
      name: 'Pastry',
      unitPrice: 80,
      quantity: 1
    }
  ],
  useRecords: [
    {
      id: 12345,                       // Record ID from card inquiry
      type: HappyCardRecordType.BONUS, // Using bonus points
      amount: 380                      // Amount to deduct
    }
  ]
});

console.log('Order ID:', order.id);
console.log('Total Price:', order.totalPrice);
console.log('Card Serial:', order.cardSerial);
```

### Card Balance Inquiry

```typescript
// Check Happy Card balance and available records
const cardInfo = await paymentGateway.searchCard('HC1234567890123456');

if (cardInfo.resultCode === '1') {
  const cardData = cardInfo.data.card_list[0];
  
  console.log('Card Serial:', cardData.card_sn);
  console.log('Available Amount:', cardData.amt);
  console.log('Available Bonus Points:', cardData.bonus);
  console.log('Product Type:', cardData.productTypeName);
  
  // Available records for usage
  cardData.record_list.forEach(record => {
    console.log(`Record ID: ${record.record_id}`);
    console.log(`Type: ${record.type === 1 ? 'Amount' : 'Bonus'}`);
    console.log(`Available: ${record.amt}`);
    console.log(`Expires: ${record.use_limit_date}`);
  });
} else {
  console.error('Card inquiry failed:', cardInfo.resultMsg);
}
```

### Mixed Payment Types

```typescript
// Payment using both amount and bonus points
const mixedPaymentOrder = await paymentGateway.prepare({
  id: 'MIXED-ORDER-001',
  cardSerial: 'HC1234567890123456',
  items: [
    {
      name: 'Premium Coffee',
      unitPrice: 200,
      quantity: 1
    },
    {
      name: 'Special Cake',
      unitPrice: 180,
      quantity: 1
    }
  ],
  useRecords: [
    {
      id: 11111,                        // Amount record
      type: HappyCardRecordType.AMOUNT,
      amount: 200                       // Pay NT$200 with stored value
    },
    {
      id: 22222,                        // Bonus record
      type: HappyCardRecordType.BONUS,
      amount: 180                       // Pay NT$180 with bonus points
    }
  ]
});
```

## Advanced Usage

### Member Integration

```typescript
// Payment with Uni Member integration
const memberOrder = await paymentGateway.prepare({
  id: 'MEMBER-ORDER-001',
  cardSerial: 'HC1234567890123456',
  uniMemberGID: 'UNI_MEMBER_123456',    // Uni Member ID
  items: [
    {
      name: 'Member Special Drink',
      unitPrice: 120,
      quantity: 1
    }
  ],
  useRecords: [
    {
      id: 33333,
      type: HappyCardRecordType.BONUS,
      amount: 120
    }
  ]
});
```

### Own Cup Discount

```typescript
// Payment with own cup discount (environmental incentive)
const ecoOrder = await paymentGateway.prepare({
  id: 'ECO-ORDER-001',
  cardSerial: 'HC1234567890123456',
  items: [
    {
      name: 'Environmentally Friendly Coffee',
      unitPrice: 100,     // Original price
      quantity: 1,
      isOwnCup: true,     // Customer brings own cup
      cupDiscount: 5      // NT$5 discount for own cup
    }
  ],
  useRecords: [
    {
      id: 44444,
      type: HappyCardRecordType.AMOUNT,
      amount: 95          // Pay discounted amount
    }
  ]
});
```

### Island Region Support

```typescript
// Payment for island regions (離島地區) with different logistics
const islandOrder = await paymentGateway.prepare({
  id: 'ISLAND-ORDER-001',
  cardSerial: 'HC1234567890123456',
  isIsland: true,               // Enable island region handling
  items: [
    {
      name: 'Island Special Product',
      unitPrice: 250,
      quantity: 1
    }
  ],
  useRecords: [
    {
      id: 55555,
      type: HappyCardRecordType.AMOUNT,
      amount: 250
    }
  ]
});
```

### POS Integration

```typescript
// Integration with POS system
const posOrder = await paymentGateway.prepare({
  id: 'POS-ORDER-001',
  posTradeNo: 'POS-TXN-20240101-001',  // POS system transaction number
  cardSerial: 'HC1234567890123456',
  items: [
    {
      name: 'POS Item 1',
      unitPrice: 150,
      quantity: 2
    }
  ],
  useRecords: [
    {
      id: 66666,
      type: HappyCardRecordType.BONUS,
      amount: 300
    }
  ]
});
```

### Transaction Refund

```typescript
// Refund a Happy Card transaction
const refundResult = await paymentGateway.refund({
  id: 'ORDER-2024-001',              // Original order ID
  cardSerial: 'HC1234567890123456',  // Card serial number
  posTradeNo: 'POS-TXN-001',         // Optional: POS transaction number
  isIsland: false                    // Island region flag
});

if (refundResult.resultCode === '1') {
  console.log('Refund successful');
  refundResult.data.card_list.forEach(card => {
    console.log('Refunded card:', card.card_sn);
    console.log('Payment number:', card.paymentNo);
    
    card.record_list.forEach(record => {
      console.log(`Refunded record ${record.record_id}: ${record.amt}`);
    });
  });
} else {
  console.error('Refund failed:', refundResult.resultMsg);
}
```

## Product Types

Happy Card supports different product types with different invoicing behaviors:

```typescript
import { HappyCardProductType } from '@rytass/payments-adapter-happy-card';

// Available product types
const productTypes = {
  // Gift cards with invoice first
  INVOICE_FIRST_HAPPY_CARD: HappyCardProductType.INVOICE_FIRST_HAPPY_CARD_GF,         // '1'
  INVOICE_FIRST_DIGITAL_GIFT: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,     // '3'
  INVOICE_FIRST_PHYSICAL_GIFT: HappyCardProductType.INVOICE_FIRST_PHYSICAL_GIFT_GF,   // '5'
  
  // Gift cards with invoice later
  INVOICE_LATER_HAPPY_CARD: HappyCardProductType.INVOICE_LATER_HAPPY_CARD_GS,         // '2'
  INVOICE_LATER_DIGITAL_GIFT: HappyCardProductType.INVOICE_LATER_DIGITAL_GIFT_GS,     // '4'
  INVOICE_LATER_PHYSICAL_GIFT: HappyCardProductType.INVOICE_LATER_PHYSICAL_GIFT_GS    // '6'
};

// Check supported product types
const isSupportedType = (productType: string) => {
  // Currently supports types '1' and '3' (invoice first types)
  return productType === '1' || productType === '3';
};
```

## Integration Examples

### Express.js API Integration

```typescript
import express from 'express';
import { HappyCardPayment, HappyCardRecordType, HappyCardBaseUrls } from '@rytass/payments-adapter-happy-card';
import { PaymentEvents } from '@rytass/payments';

const app = express();
app.use(express.json());

const paymentGateway = new HappyCardPayment({
  cSource: process.env.HAPPY_CARD_C_SOURCE!,
  key: process.env.HAPPY_CARD_SECRET_KEY!,
  baseUrl: process.env.NODE_ENV === 'production' 
    ? HappyCardBaseUrls.PRODUCTION 
    : HappyCardBaseUrls.DEVELOPMENT
});

// Handle payment success
paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, async (message) => {
  // Update database
  await updateOrderStatus(message.id, 'paid');
  console.log(`Happy Card payment committed: ${message.id}`);
});

// Card balance inquiry endpoint
app.get('/api/happy-card/:cardSerial/balance', async (req, res) => {
  try {
    const { cardSerial } = req.params;
    
    const cardInfo = await paymentGateway.searchCard(cardSerial);
    
    if (cardInfo.resultCode === '1' && cardInfo.data.card_list.length > 0) {
      const card = cardInfo.data.card_list[0];
      
      res.json({
        success: true,
        cardInfo: {
          cardSerial: card.card_sn,
          memberGid: card.memberGid,
          productType: card.productType,
          productTypeName: card.productTypeName,
          availableAmount: card.amt,
          availableBonus: card.bonus,
          isDeposit: card.is_deposit === 1,
          records: card.record_list.map(record => ({
            recordId: record.record_id,
            type: record.type,
            amount: record.amt,
            expiresAt: record.use_limit_date
          }))
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: cardInfo.resultMsg || 'Card not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create Happy Card payment endpoint
app.post('/api/payments/happy-card', async (req, res) => {
  try {
    const { orderId, cardSerial, items, useRecords, memberGid, isIsland } = req.body;
    
    const order = await paymentGateway.prepare({
      id: orderId,
      cardSerial,
      uniMemberGID: memberGid,
      isIsland: isIsland || false,
      items: items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity
      })),
      useRecords: useRecords.map(record => ({
        id: record.recordId,
        type: record.type,
        amount: record.amount
      }))
    });
    
    // Commit the order immediately for Happy Card
    const commitResult = await order.commit();
    
    res.json({
      success: true,
      order: {
        id: order.id,
        totalPrice: order.totalPrice,
        cardSerial: order.cardSerial,
        state: order.state,
        committedAt: order.committedAt
      },
      paymentResult: commitResult
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Refund endpoint
app.post('/api/payments/happy-card/:orderId/refund', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cardSerial, posTradeNo } = req.body;
    
    const refundResult = await paymentGateway.refund({
      id: orderId,
      cardSerial,
      posTradeNo
    });
    
    if (refundResult.resultCode === '1') {
      res.json({
        success: true,
        refund: {
          orderId,
          cardList: refundResult.data.card_list
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: refundResult.resultMsg
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('Happy Card payment server running on port 3000');
});
```

### NestJS Service Integration

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { 
  HappyCardPayment, 
  HappyCardRecordType, 
  HappyCardBaseUrls 
} from '@rytass/payments-adapter-happy-card';
import { PaymentEvents, OrderState } from '@rytass/payments';

@Injectable()
export class HappyCardService {
  private readonly paymentGateway: HappyCardPayment;
  
  constructor() {
    this.paymentGateway = new HappyCardPayment({
      cSource: process.env.HAPPY_CARD_C_SOURCE!,
      key: process.env.HAPPY_CARD_SECRET_KEY!,
      baseUrl: process.env.NODE_ENV === 'production' 
        ? HappyCardBaseUrls.PRODUCTION 
        : HappyCardBaseUrls.DEVELOPMENT
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.paymentGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, (message) => {
      this.handlePaymentSuccess(message);
    });
    
    this.paymentGateway.emitter.on(PaymentEvents.ORDER_FAILED, (failure) => {
      this.handlePaymentFailure(failure);
    });
  }
  
  async getCardBalance(cardSerial: string) {
    const cardInfo = await this.paymentGateway.searchCard(cardSerial);
    
    if (cardInfo.resultCode !== '1' || cardInfo.data.card_list.length === 0) {
      throw new NotFoundException('Happy Card not found or invalid');
    }
    
    const card = cardInfo.data.card_list[0];
    
    return {
      cardSerial: card.card_sn,
      memberGid: card.memberGid,
      productType: card.productType,
      productTypeName: card.productTypeName,
      availableAmount: card.amt,
      availableBonus: card.bonus,
      originalAmount: card.original_amt,
      originalBonus: card.original_bonus,
      isDeposit: card.is_deposit === 1,
      records: card.record_list.map(record => ({
        recordId: record.record_id,
        type: record.type === 1 ? 'amount' : 'bonus',
        originalAmount: record.original_amt,
        availableAmount: record.amt,
        expiresAt: record.use_limit_date,
        obtainedAt: record.get_date
      }))
    };
  }
  
  async createPayment(paymentData: {
    orderId?: string;
    cardSerial: string;
    memberGid?: string;
    isIsland?: boolean;
    items: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
    useRecords: Array<{
      recordId: number;
      type: 'amount' | 'bonus';
      amount: number;
    }>;
  }) {
    // Validate card first
    const cardInfo = await this.getCardBalance(paymentData.cardSerial);
    
    // Calculate total required amount
    const totalAmount = paymentData.useRecords.reduce((sum, record) => sum + record.amount, 0);
    const itemsTotal = paymentData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (totalAmount !== itemsTotal) {
      throw new BadRequestException('Use records total does not match items total');
    }
    
    // Create order
    const order = await this.paymentGateway.prepare({
      id: paymentData.orderId,
      cardSerial: paymentData.cardSerial,
      uniMemberGID: paymentData.memberGid,
      isIsland: paymentData.isIsland || false,
      items: paymentData.items.map(item => ({
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity
      })),
      useRecords: paymentData.useRecords.map(record => ({
        id: record.recordId,
        type: record.type === 'amount' ? HappyCardRecordType.AMOUNT : HappyCardRecordType.BONUS,
        amount: record.amount
      }))
    });
    
    // Commit payment
    const result = await order.commit();
    
    return {
      orderId: order.id,
      totalAmount: order.totalPrice,
      cardSerial: order.cardSerial,
      state: order.state,
      committedAt: order.committedAt,
      paymentResult: result
    };
  }
  
  async refundPayment(orderId: string, cardSerial: string, posTradeNo?: string) {
    const refundResult = await this.paymentGateway.refund({
      id: orderId,
      cardSerial,
      posTradeNo
    });
    
    if (refundResult.resultCode !== '1') {
      throw new BadRequestException(`Refund failed: ${refundResult.resultMsg}`);
    }
    
    return {
      orderId,
      refundedCards: refundResult.data.card_list.map(card => ({
        cardSerial: card.card_sn,
        paymentNumber: card.paymentNo,
        refundedRecords: card.record_list.map(record => ({
          recordId: record.record_id,
          type: record.type === 1 ? 'amount' : 'bonus',
          refundedAmount: record.amt,
          originalAmount: record.original_amt
        }))
      }))
    };
  }
  
  private async handlePaymentSuccess(message: any) {
    // Handle successful payment - update database, send notifications, etc.
    console.log(`Happy Card payment successful: ${message.id}`);
  }
  
  private async handlePaymentFailure(failure: any) {
    // Handle payment failure - log, notify customer, etc.
    console.error(`Happy Card payment failed: ${failure.code} - ${failure.message}`);
  }
}
```

### React Payment Component

```typescript
import React, { useState, useEffect } from 'react';

interface HappyCardPaymentProps {
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
}

const HappyCardPayment: React.FC<HappyCardPaymentProps> = ({
  items,
  onSuccess,
  onError
}) => {
  const [cardSerial, setCardSerial] = useState('');
  const [cardInfo, setCardInfo] = useState<any>(null);
  const [selectedRecords, setSelectedRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const checkCardBalance = async () => {
    if (!cardSerial || cardSerial.length !== 16) {
      onError('Please enter a valid 16-digit Happy Card number');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/happy-card/${cardSerial}/balance`);
      const data = await response.json();
      
      if (data.success) {
        setCardInfo(data.cardInfo);
      } else {
        onError(data.error);
      }
    } catch (error) {
      onError('Failed to check card balance');
    } finally {
      setIsLoading(false);
    }
  };
  
  const processPayment = async () => {
    if (selectedRecords.length === 0) {
      onError('Please select payment records');
      return;
    }
    
    const totalSelected = selectedRecords.reduce((sum, record) => sum + record.amount, 0);
    const totalRequired = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (totalSelected < totalRequired) {
      onError(`Insufficient balance. Required: ${totalRequired}, Selected: ${totalSelected}`);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/payments/happy-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardSerial,
          items,
          useRecords: selectedRecords.map(record => ({
            recordId: record.recordId,
            type: record.type,
            amount: Math.min(record.availableAmount, totalRequired) // Don't exceed required amount
          }))
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        onSuccess(data.order);
      } else {
        onError(data.error);
      }
    } catch (error) {
      onError('Payment processing failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  const totalRequired = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalSelected = selectedRecords.reduce((sum, record) => sum + record.amount, 0);
  
  return (
    <div className="happy-card-payment">
      <h3>Happy Card Payment</h3>
      
      <div className="order-summary">
        <h4>Order Items</h4>
        {items.map((item, index) => (
          <div key={index} className="item">
            <span>{item.name}</span>
            <span>{item.quantity} x NT${item.price}</span>
          </div>
        ))}
        <div className="total">
          <strong>Total: NT${totalRequired}</strong>
        </div>
      </div>
      
      <div className="card-input">
        <label>Happy Card Number:</label>
        <input
          type="text"
          value={cardSerial}
          onChange={(e) => setCardSerial(e.target.value.replace(/\D/g, '').slice(0, 16))}
          placeholder="Enter 16-digit card number"
          maxLength={16}
        />
        <button onClick={checkCardBalance} disabled={isLoading}>
          Check Balance
        </button>
      </div>
      
      {cardInfo && (
        <div className="card-info">
          <h4>Card Information</h4>
          <p>Product: {cardInfo.productTypeName}</p>
          <p>Available Amount: NT${cardInfo.availableAmount}</p>
          <p>Available Bonus: NT${cardInfo.availableBonus}</p>
          
          <h5>Available Records:</h5>
          <div className="records">
            {cardInfo.records.map((record: any) => (
              <div key={record.recordId} className="record">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedRecords.some(r => r.recordId === record.recordId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRecords([...selectedRecords, {
                          recordId: record.recordId,
                          type: record.type,
                          amount: Math.min(record.availableAmount, totalRequired - totalSelected),
                          availableAmount: record.availableAmount
                        }]);
                      } else {
                        setSelectedRecords(selectedRecords.filter(r => r.recordId !== record.recordId));
                      }
                    }}
                  />
                  {record.type === 'amount' ? 'Stored Value' : 'Bonus Points'}: NT${record.availableAmount}
                  {record.expiresAt && <span> (Expires: {record.expiresAt})</span>}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {cardInfo && selectedRecords.length > 0 && (
        <div className="payment-summary">
          <p>Selected Amount: NT${totalSelected}</p>
          <p>Required Amount: NT${totalRequired}</p>
          <button 
            onClick={processPayment} 
            disabled={isLoading || totalSelected < totalRequired}
            className="pay-button"
          >
            {isLoading ? 'Processing...' : 'Pay with Happy Card'}
          </button>
        </div>
      )}
    </div>
  );
};

export default HappyCardPayment;
```

## Error Handling

### Common Error Scenarios

```typescript
try {
  const cardInfo = await paymentGateway.searchCard('HC1234567890123456');
  
  if (cardInfo.resultCode === '0') {
    switch (cardInfo.resultMsg) {
      case 'Card not found':
        console.error('Invalid Happy Card number');
        break;
      case 'Card expired':
        console.error('Happy Card has expired');
        break;
      case 'Insufficient balance':
        console.error('Not enough balance on card');
        break;
      default:
        console.error('Card inquiry failed:', cardInfo.resultMsg);
    }
  }
} catch (error) {
  if (error.message.includes('Invalid card serial format')) {
    console.error('Card number format is invalid');
  } else if (error.message.includes('Network error')) {
    console.error('Unable to connect to Happy Card service');
  } else {
    console.error('Unexpected error:', error.message);
  }
}

// Payment processing errors
try {
  const order = await paymentGateway.prepare({
    cardSerial: 'HC1234567890123456',
    items: [/* items */],
    useRecords: [/* records */]
  });
} catch (error) {
  if (error.message.includes('Unsupported product type')) {
    console.error('This Happy Card type is not supported');
  } else if (error.message.includes('Invalid use records')) {
    console.error('Selected payment records are invalid');
  } else if (error.message.includes('Amount mismatch')) {
    console.error('Use records amount does not match order total');
  } else {
    console.error('Order preparation failed:', error.message);
  }
}
```

### Validation Helpers

```typescript
// Card serial validation
const isValidCardSerial = (cardSerial: string): boolean => {
  return /^HC\d{14}$/.test(cardSerial); // HC followed by 14 digits
};

// Record validation
const validateUseRecords = (records: any[], totalAmount: number) => {
  const recordsTotal = records.reduce((sum, record) => sum + record.amount, 0);
  
  if (recordsTotal !== totalAmount) {
    throw new Error('Use records total must match order total');
  }
  
  for (const record of records) {
    if (!record.id || record.amount <= 0) {
      throw new Error('Invalid record data');
    }
    
    if (![1, 2].includes(record.type)) {
      throw new Error('Invalid record type');
    }
  }
  
  return true;
};

// Safe payment processing
const processPaymentSafely = async (paymentData: any) => {
  try {
    // Validate inputs
    if (!isValidCardSerial(paymentData.cardSerial)) {
      throw new Error('Invalid Happy Card format');
    }
    
    validateUseRecords(paymentData.useRecords, paymentData.totalAmount);
    
    // Check card balance
    const cardInfo = await paymentGateway.searchCard(paymentData.cardSerial);
    if (cardInfo.resultCode !== '1') {
      throw new Error(`Card error: ${cardInfo.resultMsg}`);
    }
    
    // Process payment
    const order = await paymentGateway.prepare(paymentData);
    const result = await order.commit();
    
    return { success: true, order, result };
  } catch (error) {
    console.error('Payment processing error:', error);
    return { success: false, error: error.message };
  }
};
```

## Best Practices

### Configuration Management
- Store sensitive credentials (cSource, key) in environment variables
- Use different configurations for development and production environments
- Implement proper error handling for authentication failures
- Regularly validate API endpoints and credentials

### Transaction Processing
- Always validate Happy Card serial numbers before processing
- Check card balance and record availability before creating orders
- Implement proper error handling for all API calls
- Use appropriate timeouts for network operations

### Security
- Validate all input parameters before processing
- Implement proper logging for audit trails
- Use HTTPS for all API communications
- Never log sensitive card information

### Performance
- Implement caching for card balance inquiries when appropriate
- Use connection pooling for high-volume scenarios
- Monitor API response times and implement alerting
- Handle rate limiting gracefully

### User Experience
- Provide clear error messages for card-related issues
- Show available balance and records before payment
- Support both amount and bonus point payments
- Handle edge cases like expired records gracefully

## Testing

```typescript
import { HappyCardPayment, HappyCardRecordType, HappyCardBaseUrls } from '@rytass/payments-adapter-happy-card';
import { OrderState } from '@rytass/payments';

describe('Happy Card Payment Integration', () => {
  let paymentGateway: HappyCardPayment;
  
  beforeEach(() => {
    paymentGateway = new HappyCardPayment({
      cSource: 'TEST_C_SOURCE',
      key: 'TEST_SECRET_KEY',
      baseUrl: HappyCardBaseUrls.DEVELOPMENT
    });
  });
  
  it('should create order successfully', async () => {
    const order = await paymentGateway.prepare({
      cardSerial: 'HC1234567890123456',
      items: [
        {
          name: 'Test Product',
          unitPrice: 100,
          quantity: 1
        }
      ],
      useRecords: [
        {
          id: 12345,
          type: HappyCardRecordType.BONUS,
          amount: 100
        }
      ]
    });
    
    expect(order.id).toBeDefined();
    expect(order.totalPrice).toBe(100);
    expect(order.cardSerial).toBe('HC1234567890123456');
    expect(order.state).toBe(OrderState.PRE_COMMIT);
  });
  
  it('should search card successfully', async () => {
    const cardInfo = await paymentGateway.searchCard('HC1234567890123456');
    
    expect(cardInfo.resultCode).toBe('1');
    expect(cardInfo.data.card_list).toHaveLength(1);
    expect(cardInfo.data.card_list[0].card_sn).toBe('HC1234567890123456');
  });
  
  it('should handle payment commitment', async () => {
    const order = await paymentGateway.prepare({
      cardSerial: 'HC1234567890123456',
      items: [
        {
          name: 'Test Product',
          unitPrice: 200,
          quantity: 1
        }
      ],
      useRecords: [
        {
          id: 67890,
          type: HappyCardRecordType.AMOUNT,
          amount: 200
        }
      ]
    });
    
    const result = await order.commit();
    
    expect(result.resultCode).toBe('1');
    expect(order.state).toBe(OrderState.COMMITTED);
    expect(order.committedAt).toBeDefined();
  });
  
  it('should handle refunds', async () => {
    const refundResult = await paymentGateway.refund({
      id: 'TEST-ORDER-001',
      cardSerial: 'HC1234567890123456'
    });
    
    expect(refundResult.resultCode).toBe('1');
    expect(refundResult.data.card_list).toBeDefined();
  });
});
```

## API Reference

### HappyCardPayment Constructor Options

```typescript
interface HappyCardPaymentInitOptions {
  cSource: string;                      // Required: Happy Card source identifier
  key: string;                          // Required: Happy Card secret key
  posId?: string;                       // Optional: POS terminal ID (default: '01')
  baseUrl?: HappyCardBaseUrls;         // Optional: API endpoint URL
}
```

### HappyCardPayment Methods

#### `prepare(options: HappyCardPayOptions): Promise<HappyCardOrder>`

Creates a new Happy Card payment order.

**Parameters:**
- `cardSerial: string` - 16-digit Happy Card number
- `items: HappyCardOrderItem[]` - Order line items
- `useRecords: HappyCardUseRecord[]` - Payment records to use
- `id?: string` - Optional order ID (auto-generated if not provided)
- `posTradeNo?: string` - POS system transaction number
- `uniMemberGID?: string` - Uni Member ID for integration
- `isIsland?: boolean` - Island region flag
- `type?: HappyCardRecordType` - Payment type preference

#### `searchCard(cardSerial: string): Promise<HappyCardSearchCardResponse>`

Inquires Happy Card balance and available records.

**Parameters:**
- `cardSerial: string` - 16-digit Happy Card number

#### `refund(options: HappyCardRefundOptions): Promise<HappyCardRefundResponse>`

Refunds a Happy Card transaction.

**Parameters:**
- `id: string` - Original order ID
- `cardSerial: string` - Happy Card number
- `posTradeNo?: string` - POS transaction number
- `isIsland?: boolean` - Island region flag

#### `query(orderId: string): Promise<HappyCardOrder>`

Retrieves an existing order by ID.

**Parameters:**
- `orderId: string` - Order identifier

### Constants and Enums

```typescript
// Record types
enum HappyCardRecordType {
  AMOUNT = 1,  // Stored value payment
  BONUS = 2    // Bonus points payment
}

// API endpoints
enum HappyCardBaseUrls {
  PRODUCTION = 'https://prd-jp-posapi.azurewebsites.net/api/Pos',
  DEVELOPMENT = 'https://uat-pos-api.azurewebsites.net/api/Pos'
}

// Result codes
enum HappyCardResultCode {
  FAILED = '0',
  SUCCESS = '1'
}

// Product types
enum HappyCardProductType {
  INVOICE_FIRST_HAPPY_CARD_GF = '1',     // Happy Card with invoice first
  INVOICE_LATER_HAPPY_CARD_GS = '2',     // Happy Card with invoice later
  INVOICE_FIRST_DIGITAL_GIFT_GF = '3',   // Digital gift card with invoice first
  INVOICE_LATER_DIGITAL_GIFT_GS = '4',   // Digital gift card with invoice later
  INVOICE_FIRST_PHYSICAL_GIFT_GF = '5',  // Physical gift card with invoice first
  INVOICE_LATER_PHYSICAL_GIFT_GS = '6'   // Physical gift card with invoice later
}
```

## License

MIT
