# Rytass Utils - TCAT Logistics Adapter

Comprehensive logistics tracking adapter for TCAT (Taiwan Cat), one of Taiwan's leading courier and logistics companies. Provides real-time package tracking with customizable status mapping and batch processing capabilities.

## Features

- [x] Single package tracking by logistics ID
- [x] Batch tracking for multiple packages
- [x] Real-time delivery status updates
- [x] Customizable status mapping
- [x] Error handling for not found packages
- [x] HTML parsing from TCAT website
- [x] TypeScript type safety
- [x] Configurable ignore options

## Installation

```bash
npm install @rytass/logistics-adapter-tcat
# or
yarn add @rytass/logistics-adapter-tcat
```

## Basic Usage

### Quick Start with Default Configuration

```typescript
import { TCatLogisticsService, TCatLogistics } from '@rytass/logistics-adapter-tcat';

// Use default TCAT configuration
const logisticsService = new TCatLogisticsService(TCatLogistics);

// Track single package
const trackingResult = await logisticsService.trace('800978442950');
console.log('Package Status:', trackingResult[0].statusHistory);

// Track multiple packages
const multipleResults = await logisticsService.trace(['800978442950', '903404283301', '123456789012']);

multipleResults.forEach((result, index) => {
  console.log(`Package ${index + 1}:`, result.logisticsId);
  console.log('Current Status:', result.statusHistory[0]?.status);
  console.log('Last Update:', result.statusHistory[0]?.timestamp);
});
```

### Default Status Types (TCatLogisticsStatus)

The default configuration maps TCAT's Chinese status to these English status codes:

| Status              | Chinese (中文)                | Description                 |
| ------------------- | ----------------------------- | --------------------------- |
| `DELIVERED`         | 順利送達                      | Package delivered           |
| `TRANSPORTING`      | 轉運中                        | Package in transit          |
| `DELIVERING`        | 配送中                        | Out for delivery            |
| `COLLECTING`        | 取件中                        | Pickup in progress          |
| `CONSOLIDATED`      | 已集貨                        | Package consolidated        |
| `PICKUP_CANCELED`   | 取消取件                      | Pickup cancelled            |
| `SHELVED`           | 暫置營業所                    | Stored at branch            |
| `INVESTIGATING`     | 調查處理中                    | Under investigation         |
| `DELIVERING_TODAY`  | 配送中(當配下車) (當配上車)   | Same-day delivery           |
| `FAIL_PICKUP`       | 未順利取件，請洽客服中心      | Pickup failed               |
| `AWAY_HOME`         | 不在家.公司行號休息           | Recipient not home          |

The `TCatLogisticsStatusHistory` includes additional `businessPremise` field for branch location.

## Custom Configuration

### Basic Custom Configuration

```typescript
import { TCatLogisticsService, TCatLogisticsInterface } from '@rytass/logistics-adapter-tcat';

// Define custom status types
type CustomStatus = 'RECEIVED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

const customLogistics: TCatLogisticsInterface<CustomStatus> = {
  ignoreNotFound: false, // Throw error if package not found
  url: 'https://www.t-cat.com.tw/Inquire/TraceDetail.aspx',
  statusMap: (htmlContent: string, logisticsId: string) => {
    // Custom logic to parse HTML and map to your status types
    const statusHistory = parseHTMLContent(htmlContent);

    return statusHistory.map(item => ({
      status: mapToCustomStatus(item.originalStatus) as CustomStatus,
      timestamp: new Date(item.datetime),
      location: item.location,
      description: item.description,
    }));
  },
};

const logisticsService = new TCatLogisticsService(customLogistics);

// Helper functions for custom mapping
function parseHTMLContent(html: string) {
  // Parse TCAT HTML response and extract tracking information
  // Implementation depends on TCAT website structure
  return [];
}

function mapToCustomStatus(originalStatus: string): CustomStatus {
  const statusMapping: Record<string, CustomStatus> = {
    已收件: 'RECEIVED',
    理貨中: 'PROCESSING',
    配送中: 'SHIPPED',
    已送達: 'DELIVERED',
    配送失敗: 'CANCELLED',
  };

  return statusMapping[originalStatus] || 'PROCESSING';
}
```

### Advanced Custom Configuration

```typescript
import { TCatLogisticsService, TCatLogisticsInterface } from '@rytass/logistics-adapter-tcat';
import * as cheerio from 'cheerio';

type DetailedStatus =
  | 'PICKUP_SCHEDULED'
  | 'PICKUP_COMPLETED'
  | 'SORTING_FACILITY'
  | 'IN_TRANSIT_TO_DESTINATION'
  | 'ARRIVED_AT_DESTINATION'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERY_ATTEMPTED'
  | 'DELIVERED'
  | 'PICKUP_READY'
  | 'RETURNED_TO_SENDER';

const advancedLogistics: TCatLogisticsInterface<DetailedStatus> = {
  ignoreNotFound: true, // Don't throw errors for not found packages
  url: 'https://www.t-cat.com.tw/Inquire/TraceDetail.aspx',
  statusMap: (htmlContent: string, logisticsId: string) => {
    const $ = cheerio.load(htmlContent);
    const statusHistory: any[] = [];

    // Parse TCAT tracking table
    $('table.trace-table tr').each((index, element) => {
      if (index === 0) return; // Skip header row

      const cells = $(element).find('td');
      if (cells.length >= 4) {
        const datetime = $(cells[0]).text().trim();
        const location = $(cells[1]).text().trim();
        const status = $(cells[2]).text().trim();
        const description = $(cells[3]).text().trim();

        statusHistory.push({
          status: mapDetailedStatus(status),
          timestamp: parseChineseDate(datetime),
          location: location,
          description: description,
          rawStatus: status,
        });
      }
    });

    return statusHistory.reverse(); // Most recent first
  },
};

function mapDetailedStatus(status: string): DetailedStatus {
  const detailedMapping: Record<string, DetailedStatus> = {
    預約取件: 'PICKUP_SCHEDULED',
    已取件: 'PICKUP_COMPLETED',
    理貨中心處理: 'SORTING_FACILITY',
    運輸中: 'IN_TRANSIT_TO_DESTINATION',
    到達營業所: 'ARRIVED_AT_DESTINATION',
    配送中: 'OUT_FOR_DELIVERY',
    配送失敗: 'DELIVERY_ATTEMPTED',
    已送達: 'DELIVERED',
    可自取: 'PICKUP_READY',
    退回寄件人: 'RETURNED_TO_SENDER',
  };

  return detailedMapping[status] || 'IN_TRANSIT_TO_DESTINATION';
}

function parseChineseDate(dateStr: string): Date {
  // Parse Chinese date format: "113/08/14 10:30"
  const parts = dateStr.split(' ');
  const datePart = parts[0].split('/');
  const timePart = parts[1]?.split(':') || ['0', '0'];

  // Convert ROC year to AD year (ROC year + 1911)
  const year = parseInt(datePart[0]) + 1911;
  const month = parseInt(datePart[1]) - 1; // JavaScript months are 0-indexed
  const day = parseInt(datePart[2]);
  const hour = parseInt(timePart[0]);
  const minute = parseInt(timePart[1]);

  return new Date(year, month, day, hour, minute);
}

const logisticsService = new TCatLogisticsService(advancedLogistics);
```

## Configuration Options

### TCatLogisticsInterface<T>

| Property         | Type       | Required | Description                                           |
| ---------------- | ---------- | -------- | ----------------------------------------------------- |
| `ignoreNotFound` | `boolean`  | Yes      | If `true`, don't throw errors for packages not found  |
| `url`            | `string`   | Yes      | TCAT tracking URL endpoint                            |
| `statusMap`      | `function` | Yes      | Function to parse HTML and map to custom status types |

### statusMap Function Signature

```typescript
statusMap: (htmlContent: string, logisticsId: string) => StatusHistory[]
```

Where `StatusHistory` contains:

- `status: T` - Your custom status type
- `timestamp: Date` - When the status was recorded
- `location?: string` - Location information
- `description?: string` - Additional details

## Error Handling

```typescript
import { LogisticsError, ErrorCode } from '@rytass/logistics';

try {
  const result = await logisticsService.trace('INVALID_TRACKING_NUMBER');
} catch (error) {
  if (error instanceof LogisticsError) {
    switch (error.code) {
      case ErrorCode.NOT_FOUND_ERROR:
        console.log('Package not found in TCAT system');
        break;
      case ErrorCode.NETWORK_ERROR:
        console.log('Network connection failed');
        break;
      case ErrorCode.PARSING_ERROR:
        console.log('Failed to parse TCAT response');
        break;
      default:
        console.log('Unknown logistics error:', error.message);
    }
  }
}
```

## Integration Examples

### E-commerce Order Tracking

```typescript
class OrderTrackingService {
  constructor(private logisticsService: TCatLogisticsService<any>) {}

  async updateOrderStatus(orderId: string, trackingNumber: string) {
    try {
      const trackingResult = await this.logisticsService.trace(trackingNumber);

      if (trackingResult.length > 0) {
        const latestStatus = trackingResult[0].statusHistory[0];

        await this.updateOrderInDatabase(orderId, {
          trackingNumber,
          currentStatus: latestStatus.status,
          lastUpdated: latestStatus.timestamp,
          location: latestStatus.location,
          statusHistory: trackingResult[0].statusHistory,
        });

        // Send notification to customer if delivered
        if (latestStatus.status === 'DELIVERED') {
          await this.notifyCustomerDelivery(orderId);
        }
      }
    } catch (error) {
      console.error(`Failed to update tracking for order ${orderId}:`, error);
    }
  }

  async batchUpdateTracking(orders: { orderId: string; trackingNumber: string }[]) {
    const trackingNumbers = orders.map(order => order.trackingNumber);

    try {
      const results = await this.logisticsService.trace(trackingNumbers);

      // Process results and update orders
      for (let i = 0; i < results.length; i++) {
        const order = orders[i];
        const trackingResult = results[i];

        if (trackingResult.statusHistory.length > 0) {
          await this.updateOrderInDatabase(order.orderId, {
            currentStatus: trackingResult.statusHistory[0].status,
            lastUpdated: trackingResult.statusHistory[0].timestamp,
            statusHistory: trackingResult.statusHistory,
          });
        }
      }
    } catch (error) {
      console.error('Batch tracking update failed:', error);
    }
  }

  private async updateOrderInDatabase(orderId: string, trackingData: any) {
    // Implementation depends on your database
  }

  private async notifyCustomerDelivery(orderId: string) {
    // Send email/SMS notification
  }
}
```

### Logistics Dashboard

```typescript
class LogisticsDashboard {
  constructor(private logisticsService: TCatLogisticsService<any>) {}

  async getTrackingSummary(trackingNumbers: string[]) {
    const results = await this.logisticsService.trace(trackingNumbers);

    const summary = {
      total: results.length,
      byStatus: {} as Record<string, number>,
      recentUpdates: [] as any[],
      issues: [] as any[],
    };

    results.forEach(result => {
      const latestStatus = result.statusHistory[0];

      if (latestStatus) {
        // Count by status
        summary.byStatus[latestStatus.status] = (summary.byStatus[latestStatus.status] || 0) + 1;

        // Collect recent updates (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (latestStatus.timestamp > oneDayAgo) {
          summary.recentUpdates.push({
            logisticsId: result.logisticsId,
            status: latestStatus.status,
            timestamp: latestStatus.timestamp,
            location: latestStatus.location,
          });
        }

        // Identify potential issues
        if (latestStatus.status === 'DELIVERY_ATTEMPTED' || latestStatus.status === 'RETURNED_TO_SENDER') {
          summary.issues.push({
            logisticsId: result.logisticsId,
            issue: latestStatus.status,
            description: latestStatus.description,
          });
        }
      }
    });

    return summary;
  }

  async getDeliveryReport(trackingNumbers: string[], dateRange: { from: Date; to: Date }) {
    const results = await this.logisticsService.trace(trackingNumbers);

    const report = {
      totalPackages: results.length,
      delivered: 0,
      inTransit: 0,
      issues: 0,
      averageDeliveryTime: 0,
      deliveryTimes: [] as number[],
    };

    results.forEach(result => {
      const statusHistory = result.statusHistory;
      const firstStatus = statusHistory[statusHistory.length - 1]; // Oldest first
      const latestStatus = statusHistory[0]; // Most recent first

      if (latestStatus.status === 'DELIVERED') {
        report.delivered++;

        // Calculate delivery time
        if (firstStatus) {
          const deliveryTime = latestStatus.timestamp.getTime() - firstStatus.timestamp.getTime();
          report.deliveryTimes.push(deliveryTime);
        }
      } else if (latestStatus.status === 'IN_TRANSIT' || latestStatus.status === 'OUT_FOR_DELIVERY') {
        report.inTransit++;
      } else {
        report.issues++;
      }
    });

    // Calculate average delivery time
    if (report.deliveryTimes.length > 0) {
      const totalTime = report.deliveryTimes.reduce((sum, time) => sum + time, 0);
      report.averageDeliveryTime = totalTime / report.deliveryTimes.length;
    }

    return report;
  }
}
```

### Scheduled Tracking Updates

```typescript
class ScheduledTrackingService {
  constructor(
    private logisticsService: TCatLogisticsService<any>,
    private orderRepository: any,
  ) {}

  async runScheduledUpdate() {
    console.log('Starting scheduled tracking update...');

    try {
      // Get all active shipments
      const activeShipments = await this.orderRepository.getActiveShipments();

      if (activeShipments.length === 0) {
        console.log('No active shipments to track');
        return;
      }

      console.log(`Tracking ${activeShipments.length} shipments...`);

      // Process in batches to avoid overwhelming the service
      const batchSize = 10;
      for (let i = 0; i < activeShipments.length; i += batchSize) {
        const batch = activeShipments.slice(i, i + batchSize);
        await this.processBatch(batch);

        // Add delay between batches
        if (i + batchSize < activeShipments.length) {
          await this.delay(2000); // 2 second delay
        }
      }

      console.log('Scheduled tracking update completed');
    } catch (error) {
      console.error('Scheduled tracking update failed:', error);
    }
  }

  private async processBatch(shipments: any[]) {
    const trackingNumbers = shipments.map(s => s.trackingNumber);

    try {
      const results = await this.logisticsService.trace(trackingNumbers);

      for (let i = 0; i < results.length; i++) {
        const shipment = shipments[i];
        const trackingResult = results[i];

        await this.updateShipmentStatus(shipment, trackingResult);
      }
    } catch (error) {
      console.error('Batch processing failed:', error);
    }
  }

  private async updateShipmentStatus(shipment: any, trackingResult: any) {
    const latestStatus = trackingResult.statusHistory[0];

    if (!latestStatus) return;

    // Check if status changed
    if (shipment.currentStatus !== latestStatus.status) {
      await this.orderRepository.updateShipment(shipment.id, {
        currentStatus: latestStatus.status,
        lastUpdated: latestStatus.timestamp,
        statusHistory: trackingResult.statusHistory,
      });

      // Send notification for important status changes
      if (latestStatus.status === 'DELIVERED' || latestStatus.status === 'DELIVERY_ATTEMPTED') {
        await this.sendStatusNotification(shipment, latestStatus);
      }
    }
  }

  private async sendStatusNotification(shipment: any, status: any) {
    // Send email/SMS notification
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage with cron job
// import * as cron from 'node-cron';
//
// const trackingService = new ScheduledTrackingService(logisticsService, orderRepository);
//
// // Run every hour
// cron.schedule('0 * * * *', () => {
//   trackingService.runScheduledUpdate();
// });
```

## Best Practices

### Performance

- Use batch tracking for multiple packages when possible
- Implement caching to avoid unnecessary API calls
- Add delays between requests to respect rate limits
- Process tracking updates asynchronously

### Error Handling

- Always wrap tracking calls in try-catch blocks
- Implement retry logic for network failures
- Log errors for debugging and monitoring
- Handle "not found" cases gracefully

### Data Management

- Store tracking history for audit trails
- Update package status regularly but not excessively
- Clean up old tracking data periodically
- Index database fields used for tracking queries

### User Experience

- Provide meaningful status messages to customers
- Send notifications for important status changes
- Display estimated delivery dates when available
- Offer manual refresh options for real-time updates

## Testing

```typescript
// Mock TCAT service for testing
const mockTCatLogistics: TCatLogisticsInterface<'TEST_STATUS'> = {
  ignoreNotFound: false,
  url: 'https://test.example.com',
  statusMap: (html: string, id: string) => {
    // Return mock data for testing
    return [
      {
        status: 'TEST_STATUS' as const,
        timestamp: new Date(),
        location: 'Test Location',
        description: 'Test package status',
      },
    ];
  },
};

const testService = new TCatLogisticsService(mockTCatLogistics);

// Test tracking
const testResult = await testService.trace('TEST123456');
console.log('Test result:', testResult);
```

## License

MIT
