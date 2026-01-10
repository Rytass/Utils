# Rytass Utils - CTC Logistics Adapter

Taiwan CTC Express (宅配通) logistics tracking and shipping order management adapter. Provides comprehensive package tracking, shipping order creation, and status management through CTC's API.

## Features

- [x] Real-time package tracking
- [x] Batch tracking support
- [x] Shipping order creation
- [x] Order update functionality
- [x] Comprehensive status mapping
- [x] TypeScript support
- [x] Error handling

## Installation

```bash
npm install @rytass/logistics-adapter-ctc
# or
yarn add @rytass/logistics-adapter-ctc
```

## Quick Start

### Basic Tracking

> **⚠️ Security Warning:** The default `CtcLogistics` configuration contains a **hardcoded test API token**. Do **NOT** use it in production. Always provide your own `apiToken`.

```typescript
import { CtcLogisticsService, CtcLogistics } from '@rytass/logistics-adapter-ctc';

// ⚠️ IMPORTANT: Replace apiToken with your own production token
const logistics = new CtcLogisticsService({
  ...CtcLogistics,
  apiToken: process.env.CTC_API_TOKEN!, // Use your own token
});

// Track single package
const result = await logistics.trace('800978442950');
console.log('Tracking result:', result);

// Track multiple packages
const results = await logistics.trace(['800978442950', '903404283301']);
console.log('Batch tracking results:', results);
```

### Custom Configuration

```typescript
import { CtcLogisticsService, CtcLogisticsInterface } from '@rytass/logistics-adapter-ctc';

const customConfig: CtcLogisticsInterface<'DELIVERED' | 'DELIVERING' | 'SHELVED'> = {
  url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
  apiToken: 'your-api-token',
  ignoreNotFound: true, // Don't throw error for not found packages
};

const logistics = new CtcLogisticsService(customConfig);
```

## Shipping Order Management

### Create Shipping Order

```typescript
const logistics = new CtcLogisticsService({
  url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
  apiToken: 'your-api-token',
  ignoreNotFound: false,
});

// Create new shipping order
const order = await logistics.create({
  trackingNumber: 'CUSTOM-TRACKING-001', // Optional custom tracking number

  // Sender information
  senderCompany: 'Sender Company Ltd.',
  senderContactName: 'John Doe',
  senderAddress: '台北市中正區重慶南路一段122號',
  senderMobile: '0912345678',
  senderTel: '02-23456789',
  senderRemark: 'Please handle with care',

  // Receiver information
  receiverCompany: 'Receiver Company Ltd.',
  receiverContactName: 'Jane Smith',
  receiverAddress: '台北市信義區信義路五段7號',
  receiverMobile: '0987654321',
  receiverTel: '02-87654321',
  receiverRemark: 'Call before delivery',

  // Shipment details (optional - will use defaults)
  shipmentContent: '貨件',
  quantity: 1,
  weight: 1,
  volume: 1,
});

console.log('Created order:', order);
console.log('Tracking number:', order.trackingNumber);
console.log('Shipping number:', order.shippingNumber);
```

### Update Shipping Order

```typescript
// Update existing shipping order
const updatedOrder = await logistics.update({
  trackingNumber: 'EXISTING-TRACKING-001', // Required for update

  // Updated receiver information
  receiverContactName: 'New Contact',
  receiverAddress: '新地址',
  receiverMobile: '0911111111',

  // Other fields remain the same
  senderCompany: 'Sender Company Ltd.',
  senderAddress: '台北市中正區重慶南路一段122號',
  receiverCompany: 'Receiver Company Ltd.',
});
```

## Status Tracking

### Available Status Codes

```typescript
enum CtcLogisticsStatusEnum {
  CREATED = 10, // 新單
  PICKUP_EXCEPTION = 29, // 取件異常
  PICKED_UP = 30, // 已取件
  PICKUP_ARRIVED_AT_HUB = 40, // 取件到站
  IN_TRANSIT = 50, // 轉運中
  TRANSIT_ARRIVED_AT_HUB = 60, // 轉運到站
  SHELVED = 65, // 回站保管
  DELIVERING = 70, // 配送中
  DELIVERY_EXCEPTION = 75, // 配送異常
  DELIVERED = 80, // 配送完成
  EMPTY_TRIP = 87, // 空趟
  COMPLETED = 88, // 正常結案
  NOTIFICATION_SENT = 91, // 通知完成
  CANCELLED = 99, // 取消
}
```

### Track with Status History

```typescript
const trackingResult = await logistics.trace('800978442950');

// Access status history
const history = trackingResult[0].statusHistory;

history.forEach(status => {
  console.log(`Date: ${status.date}`);
  console.log(`Status: ${status.status}`);
  console.log(`Status Code: ${status.statusCode}`);
});

// Get latest status
const latestStatus = history[history.length - 1];
console.log('Current status:', latestStatus.status);
```

## Advanced Usage

### Custom Status Mapping

```typescript
type CustomStatus = 'DELIVERED' | 'DELIVERING' | 'SHELVED' | 'CUSTOM_STATUS';

interface CustomCtcLogistics extends CtcLogisticsInterface<CustomStatus> {
  url: string;
  apiToken: string;
  ignoreNotFound?: boolean;
}

const customLogistics: CustomCtcLogistics = {
  url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
  apiToken: 'your-api-token',
  ignoreNotFound: false,
};

const logistics = new CtcLogisticsService(customLogistics);
```

### Error Handling

```typescript
import { LogisticsError, ErrorCode } from '@rytass/logistics';

try {
  const result = await logistics.trace('INVALID-NUMBER');
} catch (error) {
  if (error instanceof LogisticsError) {
    switch (error.code) {
      case ErrorCode.INVALID_PARAMETER:
        console.error('Invalid tracking number');
        break;
      case ErrorCode.PERMISSION_DENIED:
        console.error('No permission to view this package');
        break;
      case ErrorCode.NOT_FOUND_ERROR:
        console.error('Package not found');
        break;
      default:
        console.error('Unknown error:', error.message);
    }
  }
}
```

### Batch Operations with Error Handling

```typescript
const trackingNumbers = ['800978442950', '903404283301', 'INVALID'];

// Configure to ignore not found errors
const logistics = new CtcLogisticsService({
  ...CtcLogistics,
  ignoreNotFound: true, // Return empty history instead of throwing
});

const results = await logistics.trace(trackingNumbers);

results.forEach((result, index) => {
  console.log(`Tracking ${trackingNumbers[index]}:`);

  if (result.statusHistory.length === 0) {
    console.log('  No tracking information available');
  } else {
    const latest = result.statusHistory[result.statusHistory.length - 1];
    console.log(`  Latest status: ${latest.status} at ${latest.date}`);
  }
});
```

## Integration Examples

### Express.js Integration

```typescript
import express from 'express';
import { CtcLogisticsService, CtcLogistics } from '@rytass/logistics-adapter-ctc';

const app = express();
// ⚠️ Replace apiToken with your own production token
const logistics = new CtcLogisticsService({
  ...CtcLogistics,
  apiToken: process.env.CTC_API_TOKEN!,
});

app.get('/track/:trackingNumber', async (req, res) => {
  try {
    const result = await logistics.trace(req.params.trackingNumber);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/shipping/create', express.json(), async (req, res) => {
  try {
    const order = await logistics.create(req.body);
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### NestJS Integration

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CtcLogisticsService, CtcLogistics } from '@rytass/logistics-adapter-ctc';

@Injectable()
export class ShippingService {
  private logistics: CtcLogisticsService;

  constructor(private configService: ConfigService) {
    // ⚠️ Use your own production API token
    this.logistics = new CtcLogisticsService({
      ...CtcLogistics,
      apiToken: this.configService.get('CTC_API_TOKEN')!,
    });
  }

  async trackPackage(trackingNumber: string) {
    return this.logistics.trace(trackingNumber);
  }

  async createShippingOrder(orderData: any) {
    return this.logistics.create(orderData);
  }

  async getLatestStatus(trackingNumber: string) {
    const [result] = await this.logistics.trace(trackingNumber);

    if (result.statusHistory.length === 0) {
      return null;
    }

    return result.statusHistory[result.statusHistory.length - 1];
  }
}
```

## API Reference

### CtcLogisticsService

Main service class for CTC logistics operations.

#### Methods

| Method                                               | Description             | Parameters                         | Returns                             |
| ---------------------------------------------------- | ----------------------- | ---------------------------------- | ----------------------------------- |
| `trace(logisticsId: string)`                         | Track single package    | Tracking number                    | `Promise<LogisticsTraceResponse[]>` |
| `trace(logisticsIds: string[])`                      | Track multiple packages | Array of tracking numbers          | `Promise<LogisticsTraceResponse[]>` |
| `create(options: CreateOrUpdateCtcLogisticsOptions)` | Create shipping order   | Order details                      | `Promise<CtcLogisticsDto>`          |
| `update(options: CreateOrUpdateCtcLogisticsOptions)` | Update shipping order   | Order details with tracking number | `Promise<CtcLogisticsDto>`          |

### Configuration Options

| Option           | Type    | Required | Description                                              |
| ---------------- | ------- | -------- | -------------------------------------------------------- |
| `url`            | string  | Yes      | CTC API endpoint URL                                     |
| `apiToken`       | string  | Yes      | API authentication token                                 |
| `ignoreNotFound` | boolean | No       | If true, returns empty history instead of throwing error |

### Types

```typescript
interface CtcLogisticsDto {
  trackingNumber?: string; // 查件單號
  shippingNumber: string; // 托運單號
}

interface CreateOrUpdateCtcLogisticsOptions {
  trackingNumber?: string;
  senderCompany: string;
  senderContactName?: string;
  senderAddress: string;
  senderTel?: string;
  senderMobile?: string;
  senderRemark?: string;
  receiverCompany: string;
  receiverContactName: string;
  receiverAddress: string;
  receiverTel?: string;
  receiverMobile?: string;
  receiverRemark?: string;
  // ... additional optional fields
}
```

## License

MIT
