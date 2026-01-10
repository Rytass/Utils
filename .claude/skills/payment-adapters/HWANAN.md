# HwaNan 華南銀行 - 完整參考文件

華南銀行信用卡線上刷卡服務整合文件，支援 MD5 CheckValue 驗證與多語言頁面。

## 安裝

```bash
npm install @rytass/payments-adapter-hwanan
```

## 初始化設定

```typescript
import { HwaNanPayment } from '@rytass/payments-adapter-hwanan';

const payment = new HwaNanPayment({
  merchantId: 'YOUR_MERCHANT_ID',      // 必填：商店代號
  terminalId: 'YOUR_TERMINAL_ID',      // 必填：終端機代號
  merchantName: 'YOUR_MERCHANT_NAME',  // 必填：商店名稱
  merID: 'YOUR_MER_ID',                // 必填：merID
  identifier: 'YOUR_IDENTIFIER',       // 必填：識別碼（用於 CheckValue 計算）
  baseUrl: 'https://eposnt.hncb.com.tw', // 選填：預設為正式環境
  withServer: true,                    // 選填：啟用內建伺服器
});
```

### 初始化參數 (HwaNanPaymentInitOptions)

| 參數 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `merchantId` | `string` | 是 | - | 商店代號 |
| `terminalId` | `string` | 是 | - | 終端機代號 |
| `merchantName` | `string` | 是 | - | 商店名稱 |
| `merID` | `string` | 是 | - | merID |
| `identifier` | `string` | 是 | - | 識別碼（用於 CheckValue 計算） |
| `baseUrl` | `string` | 否 | `'https://eposnt.hncb.com.tw'` | API 基底 URL |
| `customizePageType` | `HwaNanCustomizePageType` | 否 | `ZH_TW` | 頁面語言 |
| `customizePageVersion` | `string` | 否 | - | 自訂頁面版本（當 customizePageType = OTHER 時使用） |
| `serverHost` | `string` | 否 | `'http://localhost:3000'` | 伺服器主機 URL |
| `callbackPath` | `string` | 否 | `'/payments/hwanan/callback'` | 回呼路徑 |
| `checkoutPath` | `string` | 否 | `'/payments/hwanan/checkout'` | 結帳頁面路徑 |
| `withServer` | `boolean \| 'ngrok'` | 否 | - | 啟用內建伺服器，設為 `'ngrok'` 可自動建立 ngrok tunnel |
| `ttl` | `number` | 否 | `600000` | 訂單快取 TTL（毫秒），預設 10 分鐘 |
| `serverListener` | `function` | 否 | - | 自訂伺服器監聽器 |
| `onCommit` | `function` | 否 | - | 訂單完成回呼 |
| `onServerListen` | `function` | 否 | - | 伺服器啟動回呼 |
| `ordersCache` | `OrdersCache` | 否 | - | 自訂訂單快取實作 |

## CheckValue 驗證機制

華南銀行使用 **MD5** 演算法計算 CheckValue，確保資料完整性。

### 送出交易 CheckValue 計算

```
MD5(MD5(identifier|orderId)|merchantId|terminalId|amount).substring(16)
```

### 回傳驗證 CheckValue 計算

```
MD5(MD5(identifier|orderId)|status|errcode|authCode|authAmt|xid).substring(16)
```

## 準備訂單 (prepare)

使用 `prepare()` 方法建立訂單。

### 準備訂單參數 (HwaNanCreditCardOrderInput)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `id` | `string` | 否 | 訂單編號（未提供則自動產生） |
| `items` | `PaymentItem[]` | 是 | 商品項目 |

### 基本用法

```typescript
const order = await payment.prepare({
  id: 'ORDER-001',
  items: [
    { name: '商品A', unitPrice: 500, quantity: 2 },
    { name: '商品B', unitPrice: 300, quantity: 1 },
  ],
});

// 取得表單資料（物件格式）
console.log(order.form);

// 取得完整 HTML 表單（自動提交）
res.send(order.formHTML);
```

### Order 物件屬性

| 屬性 | 類型 | 說明 |
|------|------|------|
| `id` | `string` | 訂單編號 |
| `items` | `HwaNanOrderItem[]` | 商品項目 |
| `state` | `OrderState` | 訂單狀態 |
| `totalPrice` | `number` | 訂單總金額 |
| `createdAt` | `Date \| null` | 建立時間 |
| `committedAt` | `Date \| null` | 完成時間 |
| `platformTradeNumber` | `string \| null` | 平台交易編號 |
| `additionalInfo` | `object` | 額外資訊（含授權碼、卡號末四碼等） |
| `failedMessage` | `object \| null` | 失敗訊息 |
| `form` | `HwaNanMakeOrderPayload` | 表單資料物件 |
| `formHTML` | `string` | HTML 自動提交表單 |

## 多語言頁面支援

使用 `HwaNanCustomizePageType` 設定頁面語言：

```typescript
import { HwaNanPayment, HwaNanCustomizePageType } from '@rytass/payments-adapter-hwanan';

const payment = new HwaNanPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  terminalId: 'YOUR_TERMINAL_ID',
  merchantName: 'YOUR_MERCHANT_NAME',
  merID: 'YOUR_MER_ID',
  identifier: 'YOUR_IDENTIFIER',
  customizePageType: HwaNanCustomizePageType.EN_US,  // 英文頁面
});
```

### HwaNanCustomizePageType

```typescript
enum HwaNanCustomizePageType {
  ZH_TW = 1,  // 繁體中文
  ZH_CN = 2,  // 簡體中文
  EN_US = 3,  // 英文
  JA_JP = 4,  // 日文
  OTHER = 5,  // 其他（需搭配 customizePageVersion）
}
```

## 內建伺服器與 Ngrok

### 基本伺服器

```typescript
const payment = new HwaNanPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  terminalId: 'YOUR_TERMINAL_ID',
  merchantName: 'YOUR_MERCHANT_NAME',
  merID: 'YOUR_MER_ID',
  identifier: 'YOUR_IDENTIFIER',
  withServer: true,
  serverHost: 'http://localhost:3000',
  callbackPath: '/payments/hwanan/callback',
  onServerListen: () => {
    console.log('伺服器已啟動');
  },
  onCommit: (order) => {
    console.log('訂單完成:', order.id);
  },
});
```

### 使用 Ngrok

使用 ngrok 需設定環境變數 `NGROK_AUTHTOKEN` 並安裝 `@ngrok/ngrok`：

```bash
npm install @ngrok/ngrok
export NGROK_AUTHTOKEN=your_ngrok_token
```

```typescript
const payment = new HwaNanPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  terminalId: 'YOUR_TERMINAL_ID',
  merchantName: 'YOUR_MERCHANT_NAME',
  merID: 'YOUR_MER_ID',
  identifier: 'YOUR_IDENTIFIER',
  withServer: 'ngrok',  // 自動建立 ngrok tunnel
  serverHost: 'http://localhost:3000',
});
```

## 付款結果驗證

### 使用 isCheckValueValid 驗證簽章

```typescript
import { HwaNanNotifyPayload } from '@rytass/payments-adapter-hwanan';

app.post('/payments/hwanan/callback', async (req, res) => {
  const payload = req.body as HwaNanNotifyPayload;

  // 驗證 CheckValue
  if (!payment.isCheckValueValid(payload)) {
    console.error('CheckValue 驗證失敗');
    res.sendStatus(400);
    return;
  }

  // 處理回呼訊息
  await payment.parseCallbackMessage(payload);

  res.sendStatus(200);
});
```

### HwaNanNotifyPayload 結構

```typescript
interface HwaNanNotifyPayload {
  status: string;        // 交易狀態，'0' 為成功
  errcode: string;       // 錯誤碼
  authCode: string;      // 授權碼
  authAmt: string;       // 授權金額
  xid: string;           // 平台交易編號
  lidm: string;          // 訂單編號
  merID: string;         // merID
  Last4digitPAN: string; // 卡號末四碼
  errDesc: string;       // 錯誤描述
  encOut: string;        // 加密輸出
  checkValue: string;    // 驗證碼
  Einvoice: string;      // 電子發票資訊
}
```

### 使用事件監聽

```typescript
import { PaymentEvents } from '@rytass/payments';

// 監聽付款成功
payment.emitter.on(PaymentEvents.ORDER_COMMITTED, (order) => {
  console.log('付款成功:', order.id);
  console.log('授權碼:', order.additionalInfo?.authCode);
  console.log('卡號末四碼:', order.additionalInfo?.card4Number);
});

// 監聯付款失敗
payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => {
  console.log('付款失敗:', order.id);
  console.log('失敗原因:', order.failedMessage);
});
```

## 查詢訂單 (query)

**注意**: `query()` 方法**未支援**，會拋出錯誤。

```typescript
// 以下程式碼會拋出錯誤
const order = await payment.query('ORDER-001');  // Error: Hwa Nan Bank does not support query
```

## 退款功能 (refund)

**注意**: `refund()` 方法**未支援**，會拋出錯誤。

```typescript
// 以下程式碼會拋出錯誤
await order.refund();  // Error: Hwa Nan Bank not support refund
```

## 其他列舉

### HwaNanTransactionType

```typescript
enum HwaNanTransactionType {
  ONE_TIME = 0,      // 一次付清
  INSTALLMENTS = 1,  // 分期付款
}
```

### HwaNanAutoCapMode

```typescript
enum HwaNanAutoCapMode {
  MANUALLY = 0,  // 手動請款
  AUTO = 1,      // 自動請款
}
```

### HwaNanPaymentChannel

```typescript
enum HwaNanPaymentChannel {
  CREDIT = 1,  // 信用卡
}
```

## 完整範例

```typescript
import express from 'express';
import {
  HwaNanPayment,
  HwaNanCustomizePageType,
  HwaNanNotifyPayload,
} from '@rytass/payments-adapter-hwanan';
import { PaymentEvents, OrderState } from '@rytass/payments';

const app = express();
app.use(express.urlencoded({ extended: true }));

const payment = new HwaNanPayment({
  merchantId: process.env.HWANAN_MERCHANT_ID!,
  terminalId: process.env.HWANAN_TERMINAL_ID!,
  merchantName: process.env.HWANAN_MERCHANT_NAME!,
  merID: process.env.HWANAN_MER_ID!,
  identifier: process.env.HWANAN_IDENTIFIER!,
  customizePageType: HwaNanCustomizePageType.ZH_TW,
  serverHost: process.env.SERVER_HOST || 'http://localhost:3000',
  callbackPath: '/payments/hwanan/callback',
});

// 監聽付款結果
payment.emitter.on(PaymentEvents.ORDER_COMMITTED, (order) => {
  console.log('付款成功:', order.id);
  console.log('授權碼:', order.additionalInfo?.authCode);
});

payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => {
  console.log('付款失敗:', order.id);
  console.log('錯誤:', order.failedMessage);
});

// 建立訂單
app.post('/checkout', async (req, res) => {
  const order = await payment.prepare({
    items: req.body.items,
  });

  // 回傳自動提交表單
  res.send(order.formHTML);
});

// 付款回呼
app.post('/payments/hwanan/callback', async (req, res) => {
  const payload = req.body as HwaNanNotifyPayload;

  // 驗證 CheckValue
  if (!payment.isCheckValueValid(payload)) {
    res.sendStatus(400);
    return;
  }

  // 處理回呼訊息
  await payment.parseCallbackMessage(payload);

  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 匯出項目

```typescript
// 類別
export { HwaNanPayment } from './hwanan-payment';
export { HwaNanOrder } from './hwanan-order';
export { HwaNanOrderItem } from './hwanan-order-item';

// 型別與介面
export {
  HwaNanPaymentInitOptions,
  HwaNanOrderInput,
  HwaNanCreditCardOrderInput,
  HwaNanCommitMessage,
  HwaNanCreditCardCommitMessage,
  HwaNanMakeOrderPayload,
  HwaNanNotifyPayload,
  OrdersCache,
  GetCheckCodeArgs,
} from './typings';

// 列舉
export {
  HwaNanCustomizePageType,
  HwaNanTransactionType,
  HwaNanAutoCapMode,
  HwaNanPaymentChannel,
} from './typings';
```

更多詳細資訊請聯繫華南銀行取得技術文件。
