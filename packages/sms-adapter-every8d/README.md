# Rytass Utils - SMS (Every8d)

## Features

- [x] Send SMS
- [x] Batch send SMS
- [ ] Query credits

## Getting Started

### Send SMS

```typescript
import { SMSServiceEvery8D } from '@rytass/sms-adapter-every8d';

const USER = 'user';
const PASS = 'pass';

const smsService = new SMSServiceEvery8D({
  username: USER,
  password: PASS,
  onlyTaiwanMobileNumber: true, // Block oversea phone number
});

// Single Request
smsService.send({
  mobile: '0969999999',
  text: 'Testing',
});

// Batch Request
smsService.send([{
  mobileList: ['0969999999', '0969999998'],
  text: 'Testing2',
});

// Batch Request (Difference message)
smsService.send([{
  mobile: '0969999999',
  text: 'Testing1',
}, {
  mobile: '0969999998',
  text: 'Testing2',
}]);
```
