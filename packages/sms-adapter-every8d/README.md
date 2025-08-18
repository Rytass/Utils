# Rytass Utils - Every8D SMS Adapter

Comprehensive SMS service adapter for Every8D, Taiwan's leading SMS gateway provider. Offers reliable SMS delivery with support for single messages, batch processing, and Taiwan mobile number validation for local and international messaging needs.

## Features

- [x] Single SMS message sending
- [x] Batch SMS processing (same message to multiple recipients)
- [x] Multi-target SMS with different messages
- [x] Taiwan mobile number validation and normalization
- [x] International number support (configurable)
- [x] Delivery status tracking
- [x] Error handling and retry mechanisms
- [x] Credit balance checking
- [x] Cost-effective bulk messaging

## Installation

```bash
npm install @rytass/sms-adapter-every8d
# or
yarn add @rytass/sms-adapter-every8d
```

## Basic Usage

### Service Setup

```typescript
import { SMSServiceEvery8D } from '@rytass/sms-adapter-every8d';

const smsService = new SMSServiceEvery8D({
  username: 'YOUR_EVERY8D_USERNAME',
  password: 'YOUR_EVERY8D_PASSWORD',
  baseUrl: 'https://api.e8d.tw', // Default API endpoint
  onlyTaiwanMobileNumber: true  // Restrict to Taiwan numbers only
});
```

### Send Single SMS

```typescript
// Send single SMS message
const result = await smsService.send({
  mobile: '0987654321',
  text: 'Hello! This is a test message from Every8D.'
});

console.log('Message ID:', result.messageId);
console.log('Status:', result.status);
console.log('Cost:', result.cost);
```

### Send to Multiple Recipients (Same Message)

```typescript
// Send same message to multiple recipients
const batchResult = await smsService.send({
  mobileList: [
    '0987654321',
    '0912345678',
    '0923456789'
  ],
  text: 'Important notification: Your order has been shipped!'
});

// Returns array of results for each recipient
batchResult.forEach((result, index) => {
  console.log(`Recipient ${index + 1}:`, result.status);
});
```

### Send Different Messages to Different Recipients

```typescript
// Send different messages to different recipients
const multipleResults = await smsService.send([
  {
    mobile: '0987654321',
    text: 'Dear John, your appointment is confirmed for tomorrow at 10 AM.'
  },
  {
    mobile: '0912345678', 
    text: 'Hi Mary, your package will arrive today between 2-4 PM.'
  },
  {
    mobile: '0923456789',
    text: 'Hello Mike, thank you for your purchase! Your receipt is attached.'
  }
]);

multipleResults.forEach((result, index) => {
  console.log(`Message ${index + 1} status:`, result.status);
});
```

## Configuration Options

### SMSServiceEvery8D Options

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `username` | `string` | Yes | - | Every8D account username |
| `password` | `string` | Yes | - | Every8D account password |
| `baseUrl` | `string` | No | `'https://api.e8d.tw'` | API base URL |
| `onlyTaiwanMobileNumber` | `boolean` | No | `false` | Restrict to Taiwan mobile numbers only |

## Taiwan Mobile Number Handling

### Automatic Number Normalization

```typescript
// These formats are all normalized to 0987654321
const validFormats = [
  '0987654321',      // Standard format
  '0987-654-321',    // With dashes
  '0987 654 321',    // With spaces
  '+886987654321',   // International format
  '886987654321'     // International without +
];

// All will be normalized automatically
for (const number of validFormats) {
  const result = await smsService.send({
    mobile: number,
    text: 'Test message'
  });
}
```

### Taiwan Number Validation

```typescript
// Enable Taiwan-only validation
const strictService = new SMSServiceEvery8D({
  username: 'your-username',
  password: 'your-password',
  onlyTaiwanMobileNumber: true
});

try {
  // This will work - Taiwan mobile number
  await strictService.send({
    mobile: '0987654321',
    text: 'Valid Taiwan number'
  });
  
  // This will throw error - international number
  await strictService.send({
    mobile: '+1234567890',
    text: 'Invalid for Taiwan-only mode'
  });
} catch (error) {
  console.error('Number validation error:', error.message);
}
```

## Advanced Usage

### Message Status Tracking

```typescript
// Send message and track delivery status
const result = await smsService.send({
  mobile: '0987654321',
  text: 'Order confirmation: #12345'
});

switch (result.status) {
  case 'success':
    console.log('Message sent successfully');
    console.log('Message ID:', result.messageId);
    break;
  case 'failed':
    console.error('Message delivery failed');
    console.error('Error:', result.error);
    break;
  case 'insufficient_credit':
    console.error('Insufficient account credit');
    break;
  default:
    console.log('Unknown status:', result.status);
}
```

### Batch Processing with Error Handling

```typescript
// Robust batch processing
const recipients = [
  '0987654321',
  '0912345678',
  'invalid-number', // This will be handled gracefully
  '0923456789'
];

const message = 'Your verification code is 123456';

try {
  const results = await smsService.send({
    mobileList: recipients,
    text: message
  });
  
  // Process results
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  console.log(`Batch completed: ${successful} successful, ${failed} failed`);
  
} catch (error) {
  console.error('Batch processing error:', error);
}
```

### Template Messages

```typescript
// Create reusable message templates
class SMSTemplates {
  static verification(code: string): string {
    return `Your verification code is ${code}. Valid for 10 minutes.`;
  }
  
  static orderConfirmation(orderNumber: string, amount: number): string {
    return `Order ${orderNumber} confirmed. Total: NT$${amount}. Thank you!`;
  }
  
  static appointmentReminder(date: string, time: string): string {
    return `Reminder: Your appointment is on ${date} at ${time}. Please arrive 10 minutes early.`;
  }
}

// Use templates
await smsService.send({
  mobile: '0987654321',
  text: SMSTemplates.verification('123456')
});

await smsService.send({
  mobile: '0912345678',
  text: SMSTemplates.orderConfirmation('ORD001', 1500)
});
```

## Integration Examples

### E-commerce Order Notifications

```typescript
class OrderNotificationService {
  constructor(private smsService: SMSServiceEvery8D) {}

  async sendOrderConfirmation(order: any) {
    const message = `
      Order Confirmed! 
      Order #: ${order.id}
      Total: NT$${order.total}
      Estimated delivery: ${order.deliveryDate}
      Track: ${order.trackingUrl}
    `.trim();

    return await this.smsService.send({
      mobile: order.customerPhone,
      text: message
    });
  }

  async sendShippingNotification(order: any) {
    const message = `Your order #${order.id} has been shipped! Tracking: ${order.trackingNumber}`;
    
    return await this.smsService.send({
      mobile: order.customerPhone,
      text: message
    });
  }
}
```

### Authentication Service

```typescript
class AuthSMSService {
  constructor(private smsService: SMSServiceEvery8D) {}

  async sendVerificationCode(phoneNumber: string): Promise<string> {
    // Generate 6-digit verification code
    const code = Math.random().toString().slice(-6);
    
    const message = `Your verification code is ${code}. Do not share this code with others.`;
    
    const result = await this.smsService.send({
      mobile: phoneNumber,
      text: message
    });
    
    if (result.status === 'success') {
      // Store code in cache/database with expiration
      await this.storeVerificationCode(phoneNumber, code);
      return code;
    } else {
      throw new Error(`SMS delivery failed: ${result.error}`);
    }
  }

  async send2FACode(phoneNumber: string, serviceName: string): Promise<void> {
    const code = Math.random().toString().slice(-6);
    
    const message = `${serviceName} login code: ${code}. Valid for 5 minutes.`;
    
    await this.smsService.send({
      mobile: phoneNumber,
      text: message
    });
    
    await this.store2FACode(phoneNumber, code);
  }

  private async storeVerificationCode(phone: string, code: string) {
    // Implementation depends on your storage solution
    // Redis, database, or in-memory cache
  }

  private async store2FACode(phone: string, code: string) {
    // Store with shorter expiration for 2FA
  }
}
```

### Marketing Campaign Service

```typescript
class MarketingCampaignService {
  constructor(private smsService: SMSServiceEvery8D) {}

  async sendPromotionalCampaign(customers: any[], campaignMessage: string) {
    // Split into batches to avoid rate limiting
    const batchSize = 100;
    const batches = [];
    
    for (let i = 0; i < customers.length; i += batchSize) {
      batches.push(customers.slice(i, i + batchSize));
    }

    const results = [];
    
    for (const batch of batches) {
      const phoneNumbers = batch.map(customer => customer.phoneNumber);
      
      try {
        const batchResult = await this.smsService.send({
          mobileList: phoneNumbers,
          text: campaignMessage
        });
        
        results.push(...batchResult);
        
        // Add delay between batches to respect rate limits
        await this.delay(1000);
        
      } catch (error) {
        console.error(`Batch failed:`, error);
      }
    }

    return this.analyzeCampaignResults(results);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private analyzeCampaignResults(results: any[]) {
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);

    return {
      total: results.length,
      successful,
      failed,
      successRate: (successful / results.length) * 100,
      totalCost
    };
  }
}
```

## Environment Configuration

```bash
# .env
EVERY8D_USERNAME=your_username
EVERY8D_PASSWORD=your_password
EVERY8D_BASE_URL=https://api.e8d.tw
EVERY8D_TAIWAN_ONLY=true
```

```typescript
const smsService = new SMSServiceEvery8D({
  username: process.env.EVERY8D_USERNAME!,
  password: process.env.EVERY8D_PASSWORD!,
  baseUrl: process.env.EVERY8D_BASE_URL || 'https://api.e8d.tw',
  onlyTaiwanMobileNumber: process.env.EVERY8D_TAIWAN_ONLY === 'true'
});
```

## Error Handling

```typescript
import { Every8DError } from '@rytass/sms-adapter-every8d';

try {
  const result = await smsService.send({
    mobile: '0987654321',
    text: 'Test message'
  });
} catch (error) {
  if (error instanceof Every8DError) {
    console.error('Every8D API Error:', error.code);
    console.error('Error Message:', error.message);
    
    switch (error.code) {
      case 'INSUFFICIENT_CREDIT':
        console.log('Please top up your Every8D account');
        break;
      case 'INVALID_CREDENTIALS':
        console.log('Check your username and password');
        break;
      case 'INVALID_PHONE_NUMBER':
        console.log('Phone number format is invalid');
        break;
      default:
        console.log('Unknown error occurred');
    }
  } else {
    console.error('General error:', error.message);
  }
}
```

## Testing

### Development Testing

```typescript
// Test with valid Taiwan numbers
const testNumbers = [
  '0987654321',
  '0912345678',
  '0923456789'
];

const testMessage = 'This is a test message from development environment.';

// Test individual sends
for (const number of testNumbers) {
  try {
    const result = await smsService.send({
      mobile: number,
      text: `${testMessage} (Individual test)`
    });
    console.log(`${number}: ${result.status}`);
  } catch (error) {
    console.error(`${number} failed:`, error.message);
  }
}

// Test batch send
const batchResult = await smsService.send({
  mobileList: testNumbers,
  text: `${testMessage} (Batch test)`
});

console.log('Batch test results:', batchResult.map(r => r.status));
```

## NestJS Integration

```typescript
import { Injectable } from '@nestjs/common';
import { SMSServiceEvery8D } from '@rytass/sms-adapter-every8d';

@Injectable()
export class SMSService {
  private readonly smsService: SMSServiceEvery8D;

  constructor() {
    this.smsService = new SMSServiceEvery8D({
      username: process.env.EVERY8D_USERNAME!,
      password: process.env.EVERY8D_PASSWORD!,
      onlyTaiwanMobileNumber: true
    });
  }

  async sendSMS(phoneNumber: string, message: string) {
    return await this.smsService.send({
      mobile: phoneNumber,
      text: message
    });
  }

  async sendBatchSMS(phoneNumbers: string[], message: string) {
    return await this.smsService.send({
      mobileList: phoneNumbers,
      text: message
    });
  }
}
```

## Best Practices

### Security
- Store credentials securely in environment variables
- Never expose API credentials in client-side code
- Implement rate limiting to prevent abuse
- Log SMS activities for audit purposes

### Performance
- Use batch sending for multiple recipients with same message
- Implement proper error handling and retry mechanisms
- Add delays between large batch operations
- Monitor account credit levels

### User Experience
- Keep messages concise and clear
- Include opt-out instructions for marketing messages
- Provide delivery status feedback when possible
- Use templates for consistent messaging

### Compliance
- Comply with Taiwan telecommunications regulations
- Respect user preferences and opt-out requests
- Follow GDPR guidelines for international users
- Maintain message content standards

## License

MIT