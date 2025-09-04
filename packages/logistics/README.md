# Rytass Utils - Logistics

A unified interface for Taiwan logistics tracking services. Provides a standardized way to track packages across different logistics providers including TCAT (黑貓宅急便) and CTC (宅配通).

## Features

- [x] Unified logistics tracking interface
- [x] Multiple logistics provider support
- [x] TypeScript with strict typing
- [x] Standardized status tracking
- [x] Batch tracking support
- [x] Status history tracking
- [x] Error handling

## Installation

```bash
npm install @rytass/logistics
# or
yarn add @rytass/logistics
```

## Available Adapters

- **[@rytass/logistics-adapter-tcat](https://www.npmjs.com/package/@rytass/logistics-adapter-tcat)** - TCAT (黑貓宅急便) logistics tracking
- **[@rytass/logistics-adapter-ctc](https://www.npmjs.com/package/@rytass/logistics-adapter-ctc)** - CTC (宅配通) logistics tracking

## Basic Usage

### Using TCAT Adapter

```typescript
import { TCATLogisticsService } from '@rytass/logistics-adapter-tcat';

const tcat = new TCATLogisticsService();

// Track single package
const results = await tcat.trace('123456789');
console.log('Tracking results:', results);

// Track multiple packages
const batchResults = await tcat.trace(['123456789', '987654321']);
console.log('Batch results:', batchResults);
```

### Using CTC Adapter

```typescript
import { CTCLogisticsService } from '@rytass/logistics-adapter-ctc';

const ctc = new CTCLogisticsService();

// Track package
const results = await ctc.trace('123456789');
console.log('CTC tracking:', results);
```

## Core Concepts

### LogisticsInterface

```typescript
interface LogisticsInterface<T = LogisticsBaseStatus> {
  reference?: T;
  url: string;
}
```

### LogisticsService

```typescript
interface LogisticsService<LogisticsType extends LogisticsInterface<LogisticsStatus<LogisticsType>>> {
  trace(request: string): Promise<LogisticsTraceResponse<LogisticsType>[]>;
  trace(request: string[]): Promise<LogisticsTraceResponse<LogisticsType>[]>;
}
```

### Status Types

```typescript
type LogisticsBaseStatus = 'DELIVERED' | 'DELIVERING' | 'SHELVED';
```

### Tracking Response

```typescript
interface LogisticsTraceResponse<K extends LogisticsInterface<LogisticsStatus<K>>> {
  logisticsId: string;
  statusHistory: LogisticsStatusHistory<K['reference']>[];
}

interface LogisticsStatusHistory<T> {
  date: string;
  status: T;
}
```

## Advanced Usage

### Custom Logistics Service

```typescript
import { LogisticsService, LogisticsInterface, LogisticsTraceResponse, LogisticsStatus } from '@rytass/logistics';

interface CustomLogisticsInterface extends LogisticsInterface<'PENDING' | 'SHIPPED' | 'DELIVERED'> {
  reference: 'PENDING' | 'SHIPPED' | 'DELIVERED';
  url: string;
}

class CustomLogisticsService implements LogisticsService<CustomLogisticsInterface> {
  async trace(request: string | string[]): Promise<LogisticsTraceResponse<CustomLogisticsInterface>[]> {
    const trackingNumbers = Array.isArray(request) ? request : [request];

    const results = await Promise.all(
      trackingNumbers.map(async trackingNumber => {
        // Implement your tracking logic here
        return {
          logisticsId: trackingNumber,
          statusHistory: [
            {
              date: '2024-01-01',
              status: 'PENDING' as const,
            },
            {
              date: '2024-01-02',
              status: 'SHIPPED' as const,
            },
          ],
        };
      }),
    );

    return results;
  }
}
```

### Multi-Provider Tracking

```typescript
import { TCATLogisticsService } from '@rytass/logistics-adapter-tcat';
import { CTCLogisticsService } from '@rytass/logistics-adapter-ctc';

class MultiProviderTracker {
  private tcat = new TCATLogisticsService();
  private ctc = new CTCLogisticsService();

  async trackPackage(trackingNumber: string, provider: 'TCAT' | 'CTC') {
    try {
      switch (provider) {
        case 'TCAT':
          return await this.tcat.trace(trackingNumber);
        case 'CTC':
          return await this.ctc.trace(trackingNumber);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Failed to track with ${provider}:`, error);
      throw error;
    }
  }

  async trackWithAllProviders(trackingNumber: string) {
    const results = await Promise.allSettled([
      this.tcat.trace(trackingNumber).catch(err => ({ provider: 'TCAT', error: err })),
      this.ctc.trace(trackingNumber).catch(err => ({ provider: 'CTC', error: err })),
    ]);

    return results.map((result, index) => ({
      provider: index === 0 ? 'TCAT' : 'CTC',
      result: result.status === 'fulfilled' ? result.value : result.reason,
    }));
  }
}
```

## Integration Examples

### Express.js API

```typescript
import express from 'express';
import { TCATLogisticsService } from '@rytass/logistics-adapter-tcat';
import { CTCLogisticsService } from '@rytass/logistics-adapter-ctc';

const app = express();
const tcat = new TCATLogisticsService();
const ctc = new CTCLogisticsService();

app.get('/track/:provider/:trackingNumber', async (req, res) => {
  try {
    const { provider, trackingNumber } = req.params;

    let results;
    switch (provider.toUpperCase()) {
      case 'TCAT':
        results = await tcat.trace(trackingNumber);
        break;
      case 'CTC':
        results = await ctc.trace(trackingNumber);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported provider' });
    }

    res.json({
      success: true,
      trackingNumber,
      provider: provider.toUpperCase(),
      results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/track/batch', async (req, res) => {
  try {
    const { provider, trackingNumbers } = req.body;

    let results;
    switch (provider.toUpperCase()) {
      case 'TCAT':
        results = await tcat.trace(trackingNumbers);
        break;
      case 'CTC':
        results = await ctc.trace(trackingNumbers);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported provider' });
    }

    res.json({
      success: true,
      provider: provider.toUpperCase(),
      results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

### NestJS Service

```typescript
import { Injectable } from '@nestjs/common';
import { TCATLogisticsService } from '@rytass/logistics-adapter-tcat';
import { CTCLogisticsService } from '@rytass/logistics-adapter-ctc';

@Injectable()
export class TrackingService {
  private tcat = new TCATLogisticsService();
  private ctc = new CTCLogisticsService();

  async trackPackage(trackingNumber: string, provider: string) {
    switch (provider.toUpperCase()) {
      case 'TCAT':
        return await this.tcat.trace(trackingNumber);
      case 'CTC':
        return await this.ctc.trace(trackingNumber);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async batchTrack(trackingNumbers: string[], provider: string) {
    switch (provider.toUpperCase()) {
      case 'TCAT':
        return await this.tcat.trace(trackingNumbers);
      case 'CTC':
        return await this.ctc.trace(trackingNumbers);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async getLatestStatus(trackingNumber: string, provider: string) {
    const results = await this.trackPackage(trackingNumber, provider);

    if (results.length === 0) {
      throw new Error('No tracking information found');
    }

    const latestResult = results[0];
    const latestStatus = latestResult.statusHistory[latestResult.statusHistory.length - 1];

    return {
      trackingNumber: latestResult.logisticsId,
      currentStatus: latestStatus.status,
      lastUpdated: latestStatus.date,
      fullHistory: latestResult.statusHistory,
    };
  }
}
```

## Error Handling

```typescript
import { LogisticsErrorInterface } from '@rytass/logistics';

async function safeTrack(trackingNumber: string) {
  try {
    const tcat = new TCATLogisticsService();
    const results = await tcat.trace(trackingNumber);
    return { success: true, results };
  } catch (error) {
    if (error as LogisticsErrorInterface) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error.message,
      },
    };
  }
}
```

## API Reference

### LogisticsService Interface

```typescript
interface LogisticsService<LogisticsType> {
  trace(request: string): Promise<LogisticsTraceResponse<LogisticsType>[]>;
  trace(request: string[]): Promise<LogisticsTraceResponse<LogisticsType>[]>;
}
```

### Types

| Type                        | Description                                |
| --------------------------- | ------------------------------------------ |
| `LogisticsBaseStatus`       | `'DELIVERED' \| 'DELIVERING' \| 'SHELVED'` |
| `LogisticsInterface<T>`     | Base interface for logistics providers     |
| `LogisticsTraceResponse<K>` | Tracking response with status history      |
| `LogisticsStatusHistory<T>` | Individual status entry with date          |
| `LogisticsErrorInterface`   | Error interface with code and message      |

## Best Practices

### Error Handling

- Always wrap tracking calls in try-catch blocks
- Implement retry logic for transient failures
- Validate tracking numbers before making API calls
- Handle provider-specific error codes appropriately

### Performance

- Use batch tracking for multiple packages when possible
- Implement caching for frequently tracked packages
- Consider rate limiting to avoid provider API limits
- Use appropriate timeouts for network requests

### Data Management

- Store tracking results with timestamps
- Implement data retention policies
- Consider privacy implications of tracking data
- Validate and sanitize tracking numbers

## Taiwan Logistics Providers

### TCAT (黑貓宅急便)

- One of the largest logistics providers in Taiwan
- Supports package tracking via tracking number
- Provides detailed status updates

### CTC (宅配通)

- Major Taiwan logistics and delivery service
- Comprehensive tracking capabilities
- Integration with e-commerce platforms

## License

MIT
