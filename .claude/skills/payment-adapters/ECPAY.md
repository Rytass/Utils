# ECPay 綠界金流 - 完整參考文件

ECPay (綠界金流) 支付整合文件，支援信用卡、ATM 虛擬帳號、超商代碼、超商條碼、Apple Pay 等支付方式，以及卡片綁定與定期扣款功能。

## 安裝

```bash
npm install @rytass/payments-adapter-ecpay
```

## 初始化設定

```typescript
import { ECPayPayment } from '@rytass/payments-adapter-ecpay';
import { Channel } from '@rytass/payments';

const payment = new ECPayPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  hashKey: 'YOUR_HASH_KEY',
  hashIv: 'YOUR_HASH_IV',
  serverHost: 'https://your-domain.com',
  withServer: true,
});
```

### 初始化參數 (ECPayInitOptions)

| 參數 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `merchantId` | `string` | 否 | `'2000132'` | 商店代號 |
| `hashKey` | `string` | 否 | 測試金鑰 | Hash Key |
| `hashIv` | `string` | 否 | 測試金鑰 | Hash IV |
| `merchantCheckCode` | `string` | 否 | - | 商店檢核碼（正式環境退款時需要） |
| `baseUrl` | `string` | 否 | `'https://payment-stage.ecpay.com.tw'` | API 基底 URL |
| `language` | `Language` | 否 | `TRADITIONAL_CHINESE` | 頁面語言 |
| `serverHost` | `string` | 否 | `'http://localhost:3000'` | 伺服器主機 URL |
| `callbackPath` | `string` | 否 | `'/payments/ecpay/callback'` | 付款完成回呼路徑 |
| `asyncInfoPath` | `string` | 否 | `'/payments/ecpay/async-informations'` | 非同步資訊回呼路徑 |
| `checkoutPath` | `string` | 否 | `'/payments/ecpay/checkout'` | 結帳頁面路徑 |
| `bindCardPath` | `string` | 否 | `'/payments/ecpay/bind-card'` | 綁定卡片頁面路徑 |
| `boundCardPath` | `string` | 否 | `'/payments/ecpay/bound-card'` | 綁卡完成回呼路徑 |
| `boundCardFinishPath` | `string` | 否 | `'/payments/ecpay/bound-card-finished'` | 綁卡完成導向路徑 |
| `withServer` | `boolean \| 'ngrok'` | 否 | - | 啟用內建伺服器 |
| `ttl` | `number` | 否 | `600000` | 訂單快取 TTL（毫秒） |
| `serverListener` | `function` | 否 | - | 自訂伺服器監聽器 |
| `onCommit` | `function` | 否 | - | 訂單完成回呼 |
| `onInfoRetrieved` | `function` | 否 | - | 非同步資訊取得回呼 |
| `onServerListen` | `function` | 否 | - | 伺服器啟動回呼 |
| `emulateRefund` | `boolean` | 否 | `false` | 模擬退款（測試用） |
| `ordersCache` | `OrdersCache` | 否 | - | 自訂訂單快取 |
| `bindCardRequestsCache` | `BindCardRequestCache` | 否 | - | 自訂綁卡快取 |

## 支付方式

支付方式使用 `@rytass/payments` 的 `Channel` 列舉：

```typescript
import { Channel } from '@rytass/payments';

// ECPay 支援的 Channel
Channel.CREDIT_CARD     // 信用卡
Channel.VIRTUAL_ACCOUNT // ATM 虛擬帳號
Channel.CVS_KIOSK       // 超商代碼
Channel.CVS_BARCODE     // 超商條碼
Channel.APPLE_PAY       // Apple Pay
```

## 準備訂單 (prepare)

使用 `prepare()` 方法建立訂單。**注意：這是異步方法，需要 `await`。**

### 信用卡支付

```typescript
import { ECPayPayment, ECPayOrderCreditCardCommitMessage } from '@rytass/payments-adapter-ecpay';
import { Channel, PaymentPeriodType } from '@rytass/payments';

const order = await payment.prepare<ECPayOrderCreditCardCommitMessage>({
  channel: Channel.CREDIT_CARD,
  items: [
    { name: '商品A', unitPrice: 100, quantity: 2 },
  ],
  id: 'ORDER-001',           // 選填，未提供則自動產生
  description: '訂單描述',    // 選填
  clientBackUrl: 'https://yoursite.com/return',  // 選填，付款完成後導回
});

// 取得付款表單
res.send(order.formHTML);

// 或取得結帳 URL（需啟用 withServer）
res.redirect(order.checkoutURL);
```

### 信用卡分期

```typescript
const order = await payment.prepare<ECPayOrderCreditCardCommitMessage>({
  channel: Channel.CREDIT_CARD,
  items: [{ name: '高價商品', unitPrice: 12000, quantity: 1 }],
  installments: '3,6,12',  // 提供 3/6/12 期選項
});
```

### 信用卡紅利折抵

```typescript
const order = await payment.prepare<ECPayOrderCreditCardCommitMessage>({
  channel: Channel.CREDIT_CARD,
  items: [{ name: '商品', unitPrice: 1000, quantity: 1 }],
  allowCreditCardRedeem: true,  // 允許紅利折抵
});
```

### 銀聯卡

```typescript
const order = await payment.prepare<ECPayOrderCreditCardCommitMessage>({
  channel: Channel.CREDIT_CARD,
  items: [{ name: '商品', unitPrice: 1000, quantity: 1 }],
  allowUnionPay: true,  // 允許銀聯卡
});
```

### 記憶卡號（首次綁定）

```typescript
const order = await payment.prepare<ECPayOrderCreditCardCommitMessage>({
  channel: Channel.CREDIT_CARD,
  items: [{ name: '商品', unitPrice: 1000, quantity: 1 }],
  memory: true,              // 記憶卡號
  memberId: 'member123',     // 會員識別碼（memory 為 true 時必填）
});
```

### 定期扣款

```typescript
import { PaymentPeriodType } from '@rytass/payments';

const order = await payment.prepare<ECPayOrderCreditCardCommitMessage>({
  channel: Channel.CREDIT_CARD,
  items: [{ name: '訂閱服務', unitPrice: 299, quantity: 1 }],
  period: {
    amountPerPeriod: 299,           // 每期金額
    type: PaymentPeriodType.MONTH,  // 週期類型：DAY, MONTH, YEAR
    frequency: 1,                   // 執行頻率
    times: 12,                      // 執行次數
  },
});
```

### ATM 虛擬帳號

```typescript
import { ECPayOrderVirtualAccountCommitMessage, ECPayATMBank } from '@rytass/payments-adapter-ecpay';

const order = await payment.prepare<ECPayOrderVirtualAccountCommitMessage>({
  channel: Channel.VIRTUAL_ACCOUNT,
  items: [{ name: '商品', unitPrice: 1000, quantity: 1 }],
  virtualAccountExpireDays: 3,      // 選填，有效天數 1-60
  bank: ECPayATMBank.BOT,           // 選填，指定銀行
});
```

### ATM 銀行代碼

```typescript
enum ECPayATMBank {
  BOT = 'BOT',            // 臺灣銀行
  CHINATRUST = 'CHINATRUST', // 中國信託
  FIRST = 'FIRST',        // 第一銀行
  LAND = 'LAND',          // 土地銀行
  TACHONG = 'TACHONG',    // 大眾銀行
  PANHSIN = 'PANHSIN',    // 板信銀行
}
```

### 超商代碼

```typescript
import { ECPayOrderCVSCommitMessage } from '@rytass/payments-adapter-ecpay';

const order = await payment.prepare<ECPayOrderCVSCommitMessage>({
  channel: Channel.CVS_KIOSK,
  items: [{ name: '商品', unitPrice: 500, quantity: 1 }],
  cvsExpireMinutes: 10080,  // 選填，有效分鐘數 1-43200
});
```

### 超商條碼

```typescript
import { ECPayOrderBarcodeCommitMessage } from '@rytass/payments-adapter-ecpay';

const order = await payment.prepare<ECPayOrderBarcodeCommitMessage>({
  channel: Channel.CVS_BARCODE,
  items: [{ name: '商品', unitPrice: 300, quantity: 1 }],
  cvsBarcodeExpireDays: 7,  // 選填，有效天數 1-7
});
```

### 各支付方式金額限制

| 支付方式 | 最低金額 | 最高金額 |
|----------|----------|----------|
| 信用卡 | 5 | 199,999 |
| 虛擬帳號 | 11 | 49,999 |
| 超商代碼 | 33 | 6,000 |
| 超商條碼 | 17 | 20,000 |

### Order 物件屬性

| 屬性 | 類型 | 說明 |
|------|------|------|
| `id` | `string` | 訂單編號 |
| `items` | `ECPayOrderItem[]` | 商品項目 |
| `state` | `OrderState` | 訂單狀態 |
| `totalPrice` | `number` | 訂單總金額 |
| `createdAt` | `Date \| null` | 建立時間 |
| `committedAt` | `Date \| null` | 完成時間 |
| `platformTradeNumber` | `string \| null` | 平台交易編號 |
| `paymentType` | `ECPayCallbackPaymentType` | 支付類型 |
| `additionalInfo` | `object` | 額外資訊 |
| `asyncInfo` | `object` | 非同步資訊（虛擬帳號/超商代碼等） |
| `failedMessage` | `object \| null` | 失敗訊息 |
| `form` | `ECPayOrderForm` | 表單資料物件 |
| `formHTML` | `string` | HTML 自動提交表單 |
| `checkoutURL` | `string` | 結帳 URL（需啟用 withServer） |

## 多語言支援

```typescript
import { Language } from '@rytass/payments-adapter-ecpay';

enum Language {
  ENGLISH = 'ENG',
  KOREAN = 'KOR',
  JAPANESE = 'JPN',
  SIMPLIFIED_CHINESE = 'CHI',
  TRADITIONAL_CHINESE = '',  // 預設
}
```

## 卡片綁定

### 建立綁定請求 (prepareBindCard)

```typescript
// 建立綁定請求，傳入會員識別碼
const bindRequest = await payment.prepareBindCard(
  'member123',                                    // 會員識別碼
  'https://yoursite.com/bind-success',            // 選填，完成後導回 URL
);

// 取得綁定頁面表單
res.send(bindRequest.formHTML);

// 或取得綁定 URL（需啟用 withServer）
const bindUrl = payment.getBindingURL(bindRequest);
```

### 從已成功交易綁定卡片 (bindCardWithTransaction)

```typescript
// 從已成功的 ECPay 交易綁定卡片
const bindRequest = await payment.bindCardWithTransaction(
  'member123',           // 會員識別碼
  'ECPay_TradeNo',       // ECPay 交易編號（AllpayTradeNo）
  'BIND-001',            // 選填，綁定訂單編號
);

console.log('卡片 ID:', bindRequest.cardId);
console.log('卡號後四碼:', bindRequest.cardNumberSuffix);
```

### 查詢已綁定卡片 (queryBoundCard)

```typescript
const cardInfo = await payment.queryBoundCard('member123');

console.log('卡片 ID:', cardInfo.cardId);
console.log('卡號前六碼:', cardInfo.cardNumberPrefix);
console.log('卡號後四碼:', cardInfo.cardNumberSuffix);
console.log('綁定日期:', cardInfo.bindingDate);
console.log('卡片有效期限:', cardInfo.expireDate);
```

### BindCardRequest 物件屬性

| 屬性 | 類型 | 說明 |
|------|------|------|
| `memberId` | `string` | 會員識別碼 |
| `cardId` | `string \| undefined` | 卡片 ID（綁定成功後才有） |
| `cardNumberPrefix` | `string \| undefined` | 卡號前六碼 |
| `cardNumberSuffix` | `string \| undefined` | 卡號後四碼 |
| `bindingDate` | `Date \| undefined` | 綁定時間 |
| `state` | `ECPayBindCardRequestState` | 請求狀態 |
| `form` | `ECPayBindCardRequestPayload` | 表單資料 |
| `formHTML` | `string` | HTML 自動提交表單 |

## 使用已綁定卡片結帳 (checkoutWithBoundCard)

```typescript
const order = await payment.checkoutWithBoundCard({
  memberId: 'member123',
  cardId: 'CARD_TOKEN',         // 從綁定結果取得的卡片 ID
  items: [{ name: '商品', unitPrice: 500, quantity: 1 }],
  orderId: 'ORDER-006',         // 選填
  tradeTime: new Date(),        // 選填，交易時間
  installments: 3,              // 選填，分期期數：0, 3, 6, 12, 18, 24
});

// 結果會直接返回（不需導向付款頁面）
if (order.state === OrderState.COMMITTED) {
  console.log('付款成功');
}
```

## 付款結果處理

### 使用事件監聽

```typescript
import { PaymentEvents } from '@rytass/payments';

// 監聽付款成功
payment.emitter.on(PaymentEvents.ORDER_COMMITTED, (order) => {
  console.log('付款成功:', order.id);
  console.log('交易編號:', order.platformTradeNumber);
  console.log('付款方式:', order.paymentType);
});

// 監聽付款失敗
payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => {
  console.log('付款失敗:', order.id);
  console.log('失敗原因:', order.failedMessage);
});

// 監聽非同步資訊取得（虛擬帳號、超商代碼等）
payment.emitter.on(PaymentEvents.ORDER_INFO_RETRIEVED, (order) => {
  console.log('取得付款資訊:', order.id);
  console.log('非同步資訊:', order.asyncInfo);
  // 虛擬帳號: { bankCode, account, expiredAt }
  // 超商代碼: { paymentCode, expiredAt }
  // 超商條碼: { barcodes, expiredAt }
});

// 監聽伺服器啟動
payment.emitter.on(PaymentEvents.SERVER_LISTENED, () => {
  console.log('伺服器已啟動');
});
```

### 使用回呼函數

```typescript
const payment = new ECPayPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  hashKey: 'YOUR_HASH_KEY',
  hashIv: 'YOUR_HASH_IV',
  withServer: true,
  onCommit: (order) => {
    console.log('訂單完成:', order.id);
  },
  onInfoRetrieved: (order) => {
    console.log('取得非同步資訊:', order.asyncInfo);
  },
  onServerListen: () => {
    console.log('伺服器已啟動');
  },
});
```

## 查詢訂單 (query)

```typescript
const order = await payment.query('ORDER-001');

console.log('訂單狀態:', order.state);
console.log('付款方式:', order.paymentType);
console.log('付款時間:', order.committedAt);
console.log('交易編號:', order.platformTradeNumber);
```

## 信用卡交易狀態查詢

```typescript
import { ECPayCreditCardOrderStatus } from '@rytass/payments-adapter-ecpay';

// 查詢信用卡交易狀態（需要 gwsr 和金額）
const status = await payment.getCreditCardTradeStatus(
  order.additionalInfo.gwsr,  // 授權碼
  order.totalPrice,           // 金額
);

// ECPayCreditCardOrderStatus
// CLOSED: '已關帳'
// CANCELLED: '已取消'
// MANUALLY_CANCELLED: '操作取消'
// UNAUTHORIZED: '未授權'
// AUTHORIZED: '已授權'
```

## 信用卡退款

使用 `doOrderAction()` 方法執行退款動作：

```typescript
// 退款 (Refund)
await payment.doOrderAction(order, 'R', order.totalPrice);

// 取消授權 (Cancel)
await payment.doOrderAction(order, 'N', order.totalPrice);
```

**注意**：退款需要在初始化時設定 `merchantCheckCode`（正式環境）。

## 內建伺服器與 Ngrok

### 基本伺服器

```typescript
const payment = new ECPayPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  hashKey: 'YOUR_HASH_KEY',
  hashIv: 'YOUR_HASH_IV',
  withServer: true,
  serverHost: 'http://localhost:3000',
  onServerListen: () => {
    console.log('伺服器已啟動');
  },
});
```

### 使用 Ngrok

```bash
npm install @ngrok/ngrok
export NGROK_AUTHTOKEN=your_ngrok_token
```

```typescript
const payment = new ECPayPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  hashKey: 'YOUR_HASH_KEY',
  hashIv: 'YOUR_HASH_IV',
  withServer: 'ngrok',  // 自動建立 ngrok tunnel
});
```

## 狀態與類型列舉

### 查詢結果狀態 (ECPayQueryResultStatus)

```typescript
enum ECPayQueryResultStatus {
  PRE_COMMIT = '0',               // 尚未付款
  COMMITTED = '1',                // 已付款
  FAILED = '10200095',            // 失敗
  PAY_FAILED = '10100058',        // 付款失敗
  TRADE_DATA_NOT_FOUND = '10200047', // 查無交易
  TRANSACTION_REJECTED = '10100248', // 交易被拒
  INCORRECT_CARD_NUMBER = '10100249', // 卡號錯誤
}
```

### 付款類型 (ECPayCallbackPaymentType)

```typescript
enum ECPayCallbackPaymentType {
  CREDIT_CARD = 'Credit_CreditCard',
  ATM_BOT = 'ATM_BOT',
  ATM_CHINATRUST = 'ATM_CHINATRUST',
  ATM_FIRST = 'ATM_FIRST',
  ATM_LAND = 'ATM_LAND',
  ATM_TACHONG = 'ATM_TACHONG',
  ATM_PANHSIN = 'ATM_PANHSIN',
  CVS = 'CVS_CVS',
  CVS_OK = 'CVS_OK',
  CVS_FAMILY = 'CVS_FAMILY',
  CVS_HILIFE = 'CVS_HILIFE',
  CVS_IBON = 'CVS_IBON',
  BARCODE = 'BARCODE_BARCODE',
  APPLY_PAY = 'ApplePay',
}
```

### 綁卡請求狀態 (ECPayBindCardRequestState)

```typescript
enum ECPayBindCardRequestState {
  INITED = 'INITED',
  FORM_GENERATED = 'FORM_GENERATED',
  BOUND = 'BOUND',
  FAILED = 'FAILED',
}
```

## 完整範例

```typescript
import express from 'express';
import { ECPayPayment, ECPayOrderCreditCardCommitMessage } from '@rytass/payments-adapter-ecpay';
import { Channel, PaymentEvents, OrderState } from '@rytass/payments';

const app = express();

const payment = new ECPayPayment({
  merchantId: process.env.ECPAY_MERCHANT_ID,
  hashKey: process.env.ECPAY_HASH_KEY,
  hashIv: process.env.ECPAY_HASH_IV,
  serverHost: process.env.SERVER_HOST || 'http://localhost:3000',
  withServer: true,
});

// 監聽付款結果
payment.emitter.on(PaymentEvents.ORDER_COMMITTED, async (order) => {
  console.log('付款成功:', order.id);
  await updateOrderStatus(order.id, 'paid');
});

payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => {
  console.log('付款失敗:', order.id, order.failedMessage);
});

payment.emitter.on(PaymentEvents.ORDER_INFO_RETRIEVED, (order) => {
  console.log('取得付款資訊:', order.asyncInfo);
});

// 信用卡結帳
app.post('/checkout/credit', async (req, res) => {
  const order = await payment.prepare<ECPayOrderCreditCardCommitMessage>({
    channel: Channel.CREDIT_CARD,
    items: req.body.items,
    installments: '3,6,12',
  });
  res.send(order.formHTML);
});

// 虛擬帳號結帳
app.post('/checkout/atm', async (req, res) => {
  const order = await payment.prepare({
    channel: Channel.VIRTUAL_ACCOUNT,
    items: req.body.items,
    virtualAccountExpireDays: 3,
  });
  res.redirect(order.checkoutURL);
});

// 綁定卡片
app.post('/bind-card', async (req, res) => {
  const request = await payment.prepareBindCard(
    req.body.memberId,
    'https://yoursite.com/bind-success',
  );
  res.send(request.formHTML);
});

// 使用綁定卡片結帳
app.post('/checkout/bound-card', async (req, res) => {
  const order = await payment.checkoutWithBoundCard({
    memberId: req.body.memberId,
    cardId: req.body.cardId,
    items: req.body.items,
  });

  if (order.state === OrderState.COMMITTED) {
    res.json({ success: true, orderId: order.id });
  } else {
    res.json({ success: false, message: order.failedMessage });
  }
});

// 查詢訂單
app.get('/order/:id', async (req, res) => {
  const order = await payment.query(req.params.id);
  res.json({
    id: order.id,
    state: order.state,
    paymentType: order.paymentType,
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 匯出項目

```typescript
// 類別
export { ECPayPayment } from './ecpay-payment';
export { ECPayOrder } from './ecpay-order';
export { ECPayOrderItem } from './ecpay-order-item';
export { ECPayBindCardRequest } from './ecpay-bind-card-request';

// 列舉
export {
  ECPayCallbackPaymentType,
  ECPayQueryResultStatus,
  ECPayCreditCardOrderStatus,
  ECPayCreditCardOrderCloseStatus,
  ECPayATMBank,
} from './typings';

// 型別
export type {
  ECPayOrderForm,
  ECPayCommitMessage,
  ECPayOrderCreditCardCommitMessage,
  ECPayOrderVirtualAccountCommitMessage,
  ECPayOrderCVSCommitMessage,
  ECPayOrderBarcodeCommitMessage,
  ECPayOrderApplePayCommitMessage,
} from './typings';

// Re-export from @rytass/payments
export * from '@rytass/payments';
```

更多詳細資訊請參考 [ECPay 官方文件](https://www.ecpay.com.tw/Service/API_Dwnld)。
