# Rytass Utils - SMS

A unified SMS service interface for the Rytass ecosystem. Provides a standardized way to send SMS messages across different SMS providers including Every8D and other Taiwan SMS service providers.

## Features

- [x] Unified SMS service interface
- [x] Multiple SMS provider support
- [x] Single and batch SMS sending
- [x] Multi-target messaging
- [x] TypeScript with strict typing
- [x] Response status tracking
- [x] Error handling

## Installation

```bash
npm install @rytass/sms
# or
yarn add @rytass/sms
```

## Available Adapters

- **[@rytass/sms-adapter-every8d](https://www.npmjs.com/package/@rytass/sms-adapter-every8d)** - Every8D SMS service provider

## Basic Usage

### Using Every8D Adapter

```typescript
import { Every8dSMSService } from '@rytass/sms-adapter-every8d';

const smsService = new Every8dSMSService({
  username: 'your-username',
  password: 'your-password',
});

// Send single SMS
const response = await smsService.send({
  mobile: '+886912345678',
  text: 'Hello, this is a test message!',
});

console.log('SMS sent:', response.status);
```

### Batch SMS Sending

```typescript
// Send multiple SMS messages
const responses = await smsService.send([
  {
    mobile: '+886912345678',
    text: 'Message for first recipient',
  },
  {
    mobile: '+886987654321',
    text: 'Message for second recipient',
  },
]);

responses.forEach(response => {
  console.log(`SMS to ${response.mobile}: ${response.status}`);
});
```

### Multi-Target Messaging

```typescript
// Send same message to multiple recipients
const responses = await smsService.send({
  mobileList: ['+886912345678', '+886987654321', '+886555666777'],
  text: 'Same message for all recipients',
});

responses.forEach(response => {
  console.log(`SMS to ${response.mobile}: ${response.status}`);
});
```

## Core Concepts

### SMSService Interface

```typescript
interface SMSService<Request, SendResponse, MultiTarget> {
  send(request: Request[]): Promise<SendResponse[]>;
  send(request: Request): Promise<SendResponse>;
  send(request: MultiTarget): Promise<SendResponse[]>;
}
```

### Request Types

```typescript
interface SMSRequest {
  mobile: string;
  text: string;
}

interface MultiTargetRequest {
  mobileList: string[];
  text: string;
}
```

### Response Types

```typescript
enum SMSRequestResult {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

interface SMSSendResponse {
  messageId?: string;
  status: SMSRequestResult;
  mobile: string;
}
```

## Advanced Usage

### Custom SMS Service Implementation

```typescript
import { SMSService, SMSRequest, SMSSendResponse, MultiTargetRequest, SMSRequestResult } from '@rytass/sms';

interface CustomSMSRequest extends SMSRequest {
  priority?: 'low' | 'normal' | 'high';
  scheduledTime?: Date;
}

interface CustomSMSResponse extends SMSSendResponse {
  cost?: number;
  deliveryTime?: Date;
}

class CustomSMSService implements SMSService<CustomSMSRequest, CustomSMSResponse, MultiTargetRequest> {
  async send(request: CustomSMSRequest): Promise<CustomSMSResponse>;
  async send(request: CustomSMSRequest[]): Promise<CustomSMSResponse[]>;
  async send(request: MultiTargetRequest): Promise<CustomSMSResponse[]>;
  async send(request: any): Promise<any> {
    if (Array.isArray(request)) {
      // Handle batch sending
      return Promise.all(request.map(req => this.sendSingle(req)));
    }

    if ('mobileList' in request) {
      // Handle multi-target sending
      return Promise.all(request.mobileList.map(mobile => this.sendSingle({ mobile, text: request.text })));
    }

    // Handle single SMS
    return this.sendSingle(request);
  }

  private async sendSingle(request: CustomSMSRequest): Promise<CustomSMSResponse> {
    try {
      // Implement your SMS sending logic here
      const messageId = `msg_${Date.now()}_${Math.random()}`;

      return {
        messageId,
        status: SMSRequestResult.SUCCESS,
        mobile: request.mobile,
        cost: 0.05,
        deliveryTime: new Date(),
      };
    } catch (error) {
      return {
        status: SMSRequestResult.FAILED,
        mobile: request.mobile,
      };
    }
  }
}
```

## Integration Examples

### Express.js API

```typescript
import express from 'express';
import { Every8dSMSService } from '@rytass/sms-adapter-every8d';

const app = express();
app.use(express.json());

const smsService = new Every8dSMSService({
  username: process.env.EVERY8D_USERNAME!,
  password: process.env.EVERY8D_PASSWORD!,
});

app.post('/send-sms', async (req, res) => {
  try {
    const { mobile, text } = req.body;

    const response = await smsService.send({ mobile, text });

    res.json({
      success: response.status === 'SUCCESS',
      messageId: response.messageId,
      mobile: response.mobile,
      status: response.status,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to send SMS',
      message: error.message,
    });
  }
});
```

### NestJS Service

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Every8dSMSService } from '@rytass/sms-adapter-every8d';
import { SMSRequestResult } from '@rytass/sms';

@Injectable()
export class NotificationService {
  private smsService: Every8dSMSService;

  constructor(private configService: ConfigService) {
    this.smsService = new Every8dSMSService({
      username: this.configService.get('EVERY8D_USERNAME')!,
      password: this.configService.get('EVERY8D_PASSWORD')!,
    });
  }

  async sendVerificationCode(mobile: string, code: string): Promise<boolean> {
    const response = await this.smsService.send({
      mobile,
      text: `Your verification code is: ${code}. This code will expire in 10 minutes.`,
    });

    return response.status === SMSRequestResult.SUCCESS;
  }

  async sendBulkNotification(mobiles: string[], message: string) {
    const responses = await this.smsService.send({
      mobileList: mobiles,
      text: message,
    });

    return {
      successful: responses.filter(r => r.status === SMSRequestResult.SUCCESS).length,
      failed: responses.filter(r => r.status === SMSRequestResult.FAILED).length,
    };
  }
}
```

## Error Handling

```typescript
import { SMSRequestResult } from '@rytass/sms';

async function safeSendSMS(smsService: any, mobile: string, text: string) {
  try {
    const response = await smsService.send({ mobile, text });

    if (response.status === SMSRequestResult.SUCCESS) {
      console.log(`SMS sent successfully to ${mobile}`);
      return { success: true, messageId: response.messageId };
    } else {
      console.warn(`SMS failed to send to ${mobile}`);
      return { success: false, error: 'SMS sending failed' };
    }
  } catch (error) {
    console.error(`Error sending SMS to ${mobile}:`, error);
    return { success: false, error: error.message };
  }
}
```

## API Reference

### SMSService Interface

```typescript
interface SMSService<Request, SendResponse, MultiTarget> {
  send(request: Request[]): Promise<SendResponse[]>;
  send(request: Request): Promise<SendResponse>;
  send(request: MultiTarget): Promise<SendResponse[]>;
}
```

### Types and Enums

| Type                 | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `SMSRequestResult`   | `'SUCCESS' \| 'FAILED'`                                 |
| `SMSRequest`         | Basic SMS request with mobile and text                  |
| `SMSSendResponse`    | Response with status and optional messageId             |
| `MultiTargetRequest` | Request for sending same message to multiple recipients |

## License

MIT
