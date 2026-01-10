# NewebPay 藍新金流 - 完整參考文件

NewebPay (藍新金流) 支付整合文件，支援信用卡、WebATM、虛擬帳號（ATM 轉帳）、Android Pay、Samsung Pay、銀聯卡等支付方式，以及卡片綁定功能。

## 安裝

```bash
npm install @rytass/payments-adapter-newebpay
```

## 初始化設定

```typescript
import { NewebPayPayment } from '@rytass/payments-adapter-newebpay';

const payment = new NewebPayPayment({
  merchantId: 'YOUR_MERCHANT_ID',  // 必填：商店代號
  aesKey: 'YOUR_AES_KEY',          // 必填：AES 加密金鑰
  aesIv: 'YOUR_AES_IV',            // 必填：AES 加密向量
  withServer: true,                 // 選填：啟用內建伺服器
});
```

### 初始化參數 (NewebPayPaymentInitOptions)

| 參數 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `merchantId` | `string` | 是 | - | 商店代號 |
| `aesKey` | `string` | 是 | - | AES 加密金鑰（32 字元） |
| `aesIv` | `string` | 是 | - | AES 加密向量（16 字元） |
| `baseUrl` | `string` | 否 | `'https://ccore.newebpay.com'` | API 基底 URL |
| `language` | `AllowUILanguage` | 否 | `ZH_TW` | 預設頁面語言 |
| `serverHost` | `string` | 否 | `'http://localhost:3000'` | 伺服器主機 URL |
| `callbackPath` | `string` | 否 | `'/payments/newebpay/callback'` | 付款完成回呼路徑 |
| `asyncInfoPath` | `string` | 否 | `'/payments/newebpay/async-information'` | 非同步資訊回呼路徑 |
| `checkoutPath` | `string` | 否 | `'/payments/newebpay/checkout'` | 結帳頁面路徑 |
| `bindCardPath` | `string` | 否 | `'/payments/newebpay/bind-card'` | 綁定卡片頁面路徑 |
| `boundCardPath` | `string` | 否 | `'/payments/newebpay/bound-card'` | 卡片綁定完成回呼路徑 |
| `withServer` | `boolean \| 'ngrok'` | 否 | - | 啟用內建伺服器，設為 `'ngrok'` 可自動建立 ngrok tunnel |
| `ttl` | `number` | 否 | `600000` | 訂單快取 TTL（毫秒），預設 10 分鐘 |
| `serverListener` | `function` | 否 | - | 自訂伺服器監聽器 |
| `onCommit` | `function` | 否 | - | 訂單完成回呼 |
| `onServerListen` | `function` | 否 | - | 伺服器啟動回呼 |
| `ordersCache` | `OrdersCache` | 否 | - | 自訂訂單快取實作 |
| `bindCardRequestsCache` | `BindCardRequestCache` | 否 | - | 自訂綁卡請求快取實作 |

## AES 加密機制

NewebPay 使用 **AES-256-CBC** 加密傳輸資料。TradeInfo 為 AES 加密後的資料，TradeSha 為 SHA256 雜湊驗證。

## 支付方式 Channel

使用 `NewebPaymentChannel` 位元旗標來指定支付方式：

```typescript
import { NewebPaymentChannel } from '@rytass/payments-adapter-newebpay';

enum NewebPaymentChannel {
  CREDIT = 1,        // 信用卡
  ANDROID_PAY = 2,   // Android Pay
  SAMSUNG_PAY = 4,   // Samsung Pay
  UNION_PAY = 8,     // 銀聯卡
  WEBATM = 16,       // WebATM
  VACC = 32,         // 虛擬帳號（ATM 轉帳）
}

// 可使用位元 OR 組合多種支付方式
const channels = NewebPaymentChannel.CREDIT | NewebPaymentChannel.WEBATM;
```

## 準備訂單 (prepare)

使用 `prepare()` 方法建立訂單。根據不同支付方式有不同的輸入型別。

### 信用卡訂單 (NewebPayCreditCardOrderInput)

```typescript
import {
  NewebPayPayment,
  NewebPaymentChannel,
  NewebPayCreditCardInstallmentOptions,
} from '@rytass/payments-adapter-newebpay';

const order = await payment.prepare<NewebPayCreditCardCommitMessage>({
  channel: NewebPaymentChannel.CREDIT,
  items: [{ name: '商品', unitPrice: 1000, quantity: 1 }],
  id: 'ORDER-001',                   // 選填，未提供則自動產生
  installments: [                    // 選填，可用分期選項
    NewebPayCreditCardInstallmentOptions.THREE,
    NewebPayCreditCardInstallmentOptions.SIX,
  ],
  canUseBonus: true,                 // 選填，是否可使用紅利折抵
  language: AllowUILanguage.ZH_TW,   // 選填，頁面語言
});

// 取得自動提交表單
res.send(order.formHTML);

// 或取得結帳 URL（需啟用 withServer）
const checkoutUrl = order.checkoutURL;
```

### 分期付款選項 (NewebPayCreditCardInstallmentOptions)

```typescript
enum NewebPayCreditCardInstallmentOptions {
  THREE = 3,
  SIX = 6,
  TWELVE = 12,
  EIGHTEEN = 18,
  TWENTY_FOUR = 24,
  THIRTY = 30,
}
```

### WebATM 訂單 (NewebPayWebATMOrderInput)

```typescript
import { NewebPaymentChannel, NewebPayWebATMBank } from '@rytass/payments-adapter-newebpay';

const order = await payment.prepare<NewebPayWebATMCommitMessage>({
  channel: NewebPaymentChannel.WEBATM,
  items: [{ name: '商品', unitPrice: 1500, quantity: 1 }],
  bankTypes: [                       // 必填，可用銀行
    NewebPayWebATMBank.BANK_OF_TAIWAN,
    NewebPayWebATMBank.HWANAN_BANK,
    NewebPayWebATMBank.FIRST_BANK,
  ],
});
```

### 虛擬帳號訂單 (NewebPayVirtualAccountOrderInput)

```typescript
import { NewebPaymentChannel, NewebPayVirtualAccountBank } from '@rytass/payments-adapter-newebpay';

const order = await payment.prepare<NewebPayVirtualAccountCommitMessage>({
  channel: NewebPaymentChannel.VACC,
  items: [{ name: '商品', unitPrice: 2000, quantity: 1 }],
  bankTypes: [                       // 必填，可用銀行
    NewebPayVirtualAccountBank.BANK_OF_TAIWAN,
    NewebPayVirtualAccountBank.HWANAN_BANK,
    NewebPayVirtualAccountBank.FIRST_BANK,
  ],
});
```

### 銀行代碼列舉

```typescript
enum NewebPayWebATMBank {
  BANK_OF_TAIWAN = 'BOT',
  HWANAN_BANK = 'HNCB',
  FIRST_BANK = 'FirstBank',
}

enum NewebPayVirtualAccountBank {
  BANK_OF_TAIWAN = 'BOT',
  HWANAN_BANK = 'HNCB',
  FIRST_BANK = 'FirstBank',
}
```

### 通用訂單參數 (NewebPayPrepareOrderInput)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `channel` | `number` | 是 | 支付方式（使用 NewebPaymentChannel） |
| `items` | `PaymentItem[]` | 是 | 商品項目 |
| `id` | `string` | 否 | 訂單編號（未提供則自動產生） |
| `language` | `AllowUILanguage` | 否 | 頁面語言 |
| `tradeLimit` | `number` | 否 | 交易限時（60-900 秒） |
| `expireDate` | `string` | 否 | 到期日（格式：YYYYMMDD） |
| `clientBackUrl` | `string` | 否 | 付款完成後導回 URL |
| `email` | `string` | 否 | 買家 Email |
| `remark` | `string` | 否 | 訂單備註 |

### Order 物件屬性

| 屬性 | 類型 | 說明 |
|------|------|------|
| `id` | `string` | 訂單編號 |
| `items` | `NewebPayOrderItem[]` | 商品項目 |
| `state` | `OrderState` | 訂單狀態 |
| `totalPrice` | `number` | 訂單總金額 |
| `createdAt` | `Date \| null` | 建立時間 |
| `committedAt` | `Date \| null` | 完成時間 |
| `platformTradeNumber` | `string \| null` | 平台交易編號 |
| `channel` | `NewebPaymentChannel` | 支付方式 |
| `additionalInfo` | `AdditionalInfo` | 額外資訊（含授權碼、卡號等） |
| `asyncInfo` | `AsyncOrderInformation` | 非同步資訊（虛擬帳號等） |
| `failedMessage` | `object \| null` | 失敗訊息 |
| `form` | `NewebPayMPGMakeOrderPayload` | 表單資料物件 |
| `formHTML` | `string` | HTML 自動提交表單 |
| `checkoutURL` | `string` | 結帳 URL（需啟用 withServer） |

## 多語言頁面支援

```typescript
import { AllowUILanguage } from '@rytass/payments-adapter-newebpay';

enum AllowUILanguage {
  ZH_TW = 'zh-tw',  // 繁體中文
  EN = 'en',        // 英文
  JP = 'jp',        // 日文
}

const payment = new NewebPayPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  aesKey: 'YOUR_AES_KEY',
  aesIv: 'YOUR_AES_IV',
  language: AllowUILanguage.EN,  // 設定預設語言
});
```

## 卡片綁定 (prepareBindCard)

使用 `prepareBindCard()` 方法建立卡片綁定請求。

```typescript
// 建立綁定請求
const bindRequest = await payment.prepareBindCard(
  'member123',           // 會員識別碼（必填）
  {
    items: [{ name: '綁定驗證', unitPrice: 1, quantity: 1 }],  // 選填，驗證金額
    finishRedirectURL: 'https://yoursite.com/bind-success',   // 選填，完成後導回 URL
    orderId: 'BIND-001',                                       // 選填，訂單編號
  },
);

// 取得綁定頁面表單
res.send(bindRequest.formHTML);

// 或使用內建伺服器
const bindUrl = payment.getBindCardUrl(bindRequest);
```

### BindCardRequest 物件屬性

| 屬性 | 類型 | 說明 |
|------|------|------|
| `id` | `string` | 請求編號 |
| `memberId` | `string` | 會員識別碼 |
| `cardId` | `string \| undefined` | 綁定後的卡片 Token（綁定成功後才有） |
| `cardNumberPrefix` | `string \| undefined` | 卡號前 6 碼 |
| `cardNumberSuffix` | `string \| undefined` | 卡號後 4 碼 |
| `bindingDate` | `Date \| undefined` | 綁定時間 |
| `expireDate` | `Date \| undefined` | 卡片有效期限 |
| `state` | `OrderState` | 請求狀態 |
| `form` | `NewebPayMPGMakeOrderPayload` | 表單資料物件 |
| `formHTML` | `string` | HTML 自動提交表單 |

## 使用已綁定卡片結帳 (checkoutWithBoundCard)

```typescript
const order = await payment.checkoutWithBoundCard({
  memberId: 'member123',           // 會員識別碼
  cardId: 'TOKEN_VALUE',           // 卡片 Token（從綁定結果取得）
  items: [{ name: '商品', unitPrice: 500, quantity: 1 }],
  orderId: 'ORDER-007',            // 選填
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
  console.log('平台交易編號:', order.platformTradeNumber);
  console.log('授權碼:', order.additionalInfo?.authCode);
});

// 監聽付款失敗
payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => {
  console.log('付款失敗:', order.id);
  console.log('失敗原因:', order.failedMessage);
});

// 監聽非同步資訊（虛擬帳號等）
payment.emitter.on(PaymentEvents.ORDER_INFO_RETRIEVED, (order) => {
  console.log('收到非同步資訊:', order.id);
  console.log('虛擬帳號資訊:', order.asyncInfo);
});

// 監聽卡片綁定成功
payment.emitter.on(PaymentEvents.CARD_BOUND, (request) => {
  console.log('卡片綁定成功');
  console.log('卡片 Token:', request.cardId);
  console.log('卡號後四碼:', request.cardNumberSuffix);
});

// 監聽伺服器啟動
payment.emitter.on(PaymentEvents.SERVER_LISTENED, () => {
  console.log('伺服器已啟動');
});
```

### 使用回呼函數

```typescript
const payment = new NewebPayPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  aesKey: 'YOUR_AES_KEY',
  aesIv: 'YOUR_AES_IV',
  withServer: true,
  onCommit: (order) => {
    console.log('訂單完成:', order.id);
  },
  onServerListen: () => {
    console.log('伺服器已啟動');
  },
});
```

## 查詢訂單 (query)

```typescript
// 查詢訂單需提供訂單編號和金額
const order = await payment.query('ORDER-001', 1000);

console.log('訂單狀態:', order.state);
console.log('支付方式:', order.channel);
console.log('交易時間:', order.committedAt);
```

## 信用卡請款與退款

### 請款 (settle)

```typescript
// 訂單完成後，若為手動請款模式，需呼叫 settle 進行請款
await payment.settle(order);

// 或透過訂單方法
await order.creditCardSettle();
```

### 取消授權 (cancel)

```typescript
// 尚未請款的訂單可取消授權
await payment.cancel(order);
```

### 取消請款 (unsettle)

```typescript
// 已送出請款但尚未結算的訂單可取消請款
await payment.unsettle(order);
```

### 退款 (refund)

```typescript
// 已結算的訂單進行退款
await payment.refund(order);

// 或透過訂單方法（會根據狀態自動選擇 cancel/unsettle/refund）
await order.refund();
```

### 取消退款 (cancelRefund)

```typescript
// 已送出退款但尚未結算的訂單可取消退款
await payment.cancelRefund(order);

// 或透過訂單方法
await order.cancelRefund();
```

## 請款/退款狀態 (NewebPayCreditCardBalanceStatus)

```typescript
enum NewebPayCreditCardBalanceStatus {
  UNSETTLED = '0',  // 未請款/未退款
  WAITING = '1',    // 等待請款/退款
  WORKING = '2',    // 請款/退款處理中
  SETTLED = '3',    // 已請款/已退款
}
```

## 內建伺服器與 Ngrok

### 基本伺服器

```typescript
const payment = new NewebPayPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  aesKey: 'YOUR_AES_KEY',
  aesIv: 'YOUR_AES_IV',
  withServer: true,
  serverHost: 'http://localhost:3000',
  onServerListen: () => {
    console.log('伺服器已啟動');
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
const payment = new NewebPayPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  aesKey: 'YOUR_AES_KEY',
  aesIv: 'YOUR_AES_IV',
  withServer: 'ngrok',  // 自動建立 ngrok tunnel
});
```

## 完整範例

```typescript
import express from 'express';
import {
  NewebPayPayment,
  NewebPaymentChannel,
  NewebPayCreditCardInstallmentOptions,
} from '@rytass/payments-adapter-newebpay';
import { PaymentEvents, OrderState } from '@rytass/payments';

const app = express();

const payment = new NewebPayPayment({
  merchantId: process.env.NEWEBPAY_MERCHANT_ID!,
  aesKey: process.env.NEWEBPAY_AES_KEY!,
  aesIv: process.env.NEWEBPAY_AES_IV!,
  withServer: true,
  serverHost: process.env.SERVER_HOST || 'http://localhost:3000',
});

// 監聽付款結果
payment.emitter.on(PaymentEvents.ORDER_COMMITTED, (order) => {
  console.log('付款成功:', order.id);
});

payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => {
  console.log('付款失敗:', order.id, order.failedMessage);
});

payment.emitter.on(PaymentEvents.CARD_BOUND, (request) => {
  console.log('卡片綁定成功:', request.cardId);
});

// 建立信用卡訂單
app.post('/checkout/credit', async (req, res) => {
  const order = await payment.prepare({
    channel: NewebPaymentChannel.CREDIT,
    items: req.body.items,
    installments: [
      NewebPayCreditCardInstallmentOptions.THREE,
      NewebPayCreditCardInstallmentOptions.SIX,
    ],
  });

  res.send(order.formHTML);
});

// 建立虛擬帳號訂單
app.post('/checkout/vacc', async (req, res) => {
  const order = await payment.prepare({
    channel: NewebPaymentChannel.VACC,
    items: req.body.items,
    bankTypes: ['BOT', 'HNCB'],
  });

  res.redirect(order.checkoutURL);
});

// 綁定卡片
app.post('/bind-card', async (req, res) => {
  const request = await payment.prepareBindCard(req.body.memberId, {
    finishRedirectURL: 'https://yoursite.com/bind-success',
  });

  res.send(request.formHTML);
});

// 使用已綁定卡片結帳
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

// 退款
app.post('/refund/:orderId', async (req, res) => {
  const order = await payment.query(req.params.orderId, req.body.amount);
  await order.refund();
  res.json({ success: true });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 匯出項目

```typescript
// 類別
export { NewebPayPayment } from './newebpay-payment';
export { NewebPayOrder } from './newebpay-order';
export { NewebPayOrderItem } from './newebpay-order-item';

// 列舉
export {
  NewebPaymentChannel,
  NewebPayCreditCardBalanceStatus,
  NewebPayOrderStatusFromAPI,
} from './typings';
export { NewebPayVirtualAccountBank } from './typings/virtual-account.typing';
export { NewebPayWebATMBank } from './typings/webatm.typing';
export { NewebPayCreditCardInstallmentOptions } from './typings/credit-card.typing';

// 型別
export type { NewebPayMPGMakeOrderPayload } from './typings';
export type { NewebPayVirtualAccountCommitMessage } from './typings/virtual-account.typing';
export type { NewebPayWebATMCommitMessage } from './typings/webatm.typing';
export type {
  NewebPayAdditionInfoCreditCard,
  NewebPayCreditCardCommitMessage,
} from './typings/credit-card.typing';
```

更多詳細資訊請參考 [NewebPay 官方文件](https://www.newebpay.com)。
