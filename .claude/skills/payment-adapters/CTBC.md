# CTBC 中國信託 Micro Fast Pay - 完整參考文件

CTBC 微付速金流整合文件，這是一個**綁卡交易系統 (Token Store)**，支援卡片綁定、使用已綁定卡片結帳功能。另外提供 POS API 和 AMEX SOAP API 進行後台交易操作（查詢、退款、取消等）。

## 安裝

```bash
npm install @rytass/payments-adapter-ctbc-micro-fast-pay
```

## 系統架構說明

CTBC 微付速金流是**綁卡交易系統**，與一般信用卡金流不同：

1. **卡片綁定**: 用戶先完成卡片綁定，取得 CardToken
2. **綁卡結帳**: 使用 CardToken 進行後續交易
3. **POS API**: 後台操作（查詢、退款、取消）- 適用於一般 Visa/MasterCard/JCB
4. **AMEX SOAP API**: 美國運通卡專用後台操作

## 初始化設定

```typescript
import { CTBCPayment } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const payment = new CTBCPayment({
  merchantId: 'YOUR_MERCHANT_ID',  // 必填：商店代號
  merId: 'YOUR_MER_ID',            // 必填：merID
  txnKey: 'YOUR_TXN_KEY',          // 必填：交易金鑰
  terminalId: 'YOUR_TERMINAL_ID',  // 必填：終端機代號
  merchantName: 'YOUR_SHOP_NAME',  // 選填：商店名稱
  baseUrl: 'https://testepos.ctbcbank.com', // 選填：預設為測試環境
  withServer: true,                // 選填：啟用內建伺服器
});
```

### 初始化參數 (CTBCPaymentOptions)

| 參數 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `merchantId` | `string` | 是 | - | 商店代號 |
| `merId` | `string` | 是 | - | merID |
| `txnKey` | `string` | 是 | - | 交易金鑰 (用於 MAC/TXN 加密) |
| `terminalId` | `string` | 是 | - | 終端機代號 |
| `merchantName` | `string` | 否 | - | 商店名稱 |
| `baseUrl` | `string` | 否 | `'https://testepos.ctbcbank.com'` | API 基底 URL |
| `withServer` | `boolean \| 'ngrok'` | 否 | - | 啟用內建伺服器 |
| `serverHost` | `string` | 否 | `'http://localhost:3000'` | 伺服器主機 URL |
| `callbackPath` | `string` | 否 | `'/payments/ctbc/callback'` | 回呼路徑 |
| `checkoutPath` | `string` | 否 | `'/payments/ctbc/checkout'` | 結帳頁面路徑 |
| `bindCardPath` | `string` | 否 | `'/payments/ctbc/bind-card'` | 綁卡頁面路徑 |
| `boundCardPath` | `string` | 否 | `'/payments/ctbc/bound-card'` | 綁卡完成回呼路徑 |
| `boundCardCheckoutResultPath` | `string` | 否 | `'/payments/ctbc/bound-card/checkout-result'` | 綁卡結帳結果路徑 |
| `serverListener` | `function` | 否 | - | 自訂伺服器監聽器 |
| `onServerListen` | `function` | 否 | - | 伺服器啟動回呼 |
| `onCommit` | `function` | 否 | - | 訂單完成回呼 |
| `orderCache` | `OrderCache` | 否 | - | 自訂訂單快取實作 |
| `orderCacheTTL` | `number` | 否 | `600000` | 訂單快取 TTL（毫秒），預設 10 分鐘 |
| `bindCardRequestsCache` | `BindCardRequestCache` | 否 | - | 自訂綁卡請求快取實作 |
| `bindCardRequestsCacheTTL` | `number` | 否 | `600000` | 綁卡請求快取 TTL |
| `isAmex` | `boolean` | 否 | `false` | 是否使用 AMEX 查詢 API |

## MAC/TXN 簽章機制

CTBC 採用 3DES-CBC 加密機制：
- **MAC**: 訊息完整性驗證
- **TXN**: 交易資料加密

加密金鑰由 `txnKey` 衍生而來。

## 卡片綁定流程

### 1. 準備綁卡請求

```typescript
const bindRequest = await payment.prepareBindCard('MEMBER_ID_001', {
  requestId: 'BIND_REQUEST_001',  // 選填：綁卡交易序號
  finishRedirectURL: 'https://your-domain.com/bind-callback', // 選填
  promoCode: 'PROMO123',          // 選填：活動代碼
  Pid: 'A123456789',              // 選填：身分證字號
  PhoneNum: '0912345678',         // 選填：手機號碼
  PhoneNumEditable: '0',          // 選填：'0' 不可編輯, '1' 可編輯
  Birthday: new Date('1990-01-15'), // 選填：生日
});

// 取得綁卡頁面 HTML
res.send(bindRequest.formHTML);
```

### 2. 綁卡完成後取得 CardToken

綁卡成功後，可從 `CTBCBindCardRequest` 物件取得：

```typescript
console.log(bindRequest.cardToken);    // 卡片 Token
console.log(bindRequest.cardNoMask);   // 卡號遮罩
console.log(bindRequest.state);        // 綁卡狀態
```

### CTBCBindCardRequestState

```typescript
enum CTBCBindCardRequestState {
  INITED = 'INITED',           // 已初始化
  FORM_GENERATED = 'FORM_GENERATED', // 已產生表單
  BOUND = 'BOUND',             // 綁卡成功
  FAILED = 'FAILED',           // 綁卡失敗
}
```

## 一般交易（非綁卡）

如果不使用綁卡功能，可使用 `prepare()` 建立訂單並跳轉至 CTBC 付款頁面：

```typescript
import { CardType } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const order = await payment.prepare({
  id: 'ORDER-001',  // 選填：最長 19 字元，僅英數字和底線
  items: [
    { name: '商品A', unitPrice: 500, quantity: 2 },
  ],
  cardType: CardType.VMJ,      // 選填：VMJ (Visa/Master/JCB) 或 AE (AMEX)
  clientBackUrl: 'https://your-domain.com/return', // 選填：付款完成返回 URL
});

// 取得結帳 URL
const checkoutUrl = payment.getCheckoutUrl(order);

// 或直接回傳自動提交表單
res.send(order.formHTML);
```

**注意**: 訂單 ID 限制最長 19 字元，只能包含英數字和底線。

## 使用已綁定卡片結帳

```typescript
const order = await payment.checkoutWithBoundCard({
  cardId: 'CARD_TOKEN_FROM_BIND',  // 綁定的卡片 Token
  memberId: 'MEMBER_ID_001',       // 綁定會員 ID
  items: [
    { name: '商品B', unitPrice: 1000, quantity: 1 },
  ],
  orderId: 'ORDER-002',            // 選填
});
```

## 內建伺服器與 Ngrok

### 基本伺服器

```typescript
const payment = new CTBCPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  merId: 'YOUR_MER_ID',
  txnKey: 'YOUR_TXN_KEY',
  terminalId: 'YOUR_TERMINAL_ID',
  withServer: true,
  serverHost: 'http://localhost:3000',
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
const payment = new CTBCPayment({
  merchantId: 'YOUR_MERCHANT_ID',
  merId: 'YOUR_MER_ID',
  txnKey: 'YOUR_TXN_KEY',
  terminalId: 'YOUR_TERMINAL_ID',
  withServer: 'ngrok',  // 自動建立 ngrok tunnel
  serverHost: 'http://localhost:3000',
});
```

## 事件監聽

使用 `emitter` 監聽付款事件：

```typescript
import { PaymentEvents } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

// 監聽付款成功
payment.emitter.on(PaymentEvents.ORDER_COMMITTED, (order) => {
  console.log('付款成功:', order.id);
  console.log('授權碼:', order.additionalInfo?.authCode);
});

// 監聽付款失敗
payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => {
  console.log('付款失敗:', order.id);
  console.log('錯誤:', order.failedMessage);
});

// 監聽伺服器啟動
payment.emitter.on(PaymentEvents.SERVER_LISTENED, () => {
  console.log('伺服器已啟動');
});
```

## 訂單查詢

```typescript
// 查詢訂單（會根據 isAmex 設定自動選擇 POS API 或 AMEX API）
const order = await payment.query('ORDER-001');

console.log(order.id);
console.log(order.state);
console.log(order.additionalInfo);
```

---

## POS API (後台交易操作)

POS API 用於後台進行交易查詢、退款、取消等操作，適用於一般 Visa/MasterCard/JCB 卡。

### 設定

```typescript
import {
  posApiQuery,
  posApiRefund,
  posApiCancelRefund,
  posApiReversal,
  posApiCapRev,
  posApiSmartCancelOrRefund,
  getPosNextActionFromInquiry,
  CTBCPosApiConfig,
} from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const config: CTBCPosApiConfig = {
  URL: 'https://testepos.ctbcbank.com/MicroPos',  // 測試環境
  MacKey: 'YOUR_MAC_KEY',  // 8 或 24 字元
};
```

### 交易查詢 (posApiQuery)

```typescript
import { CTBCPosApiQueryParams } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const params: CTBCPosApiQueryParams = {
  MERID: '000100001234567',        // 商店代號
  'LID-M': 'ORDER001',             // 訂單編號 (最長 19 字元)
  TxType: 'Q',                     // 可選: Q(查詢), A(授權), S(請款), V(取消), R(退款)
  TxID: 'TXN123',                  // 可選: 交易 ID
  Tx_ATTRIBUTE: 'TX_AUTH',         // 可選: TX_AUTH, TX_SETTLE, TX_VOID, TX_REFUND
};

const response = await posApiQuery(config, params);

if (typeof response !== 'number') {
  console.log('回應代碼:', response.RespCode);  // '0' 成功
  console.log('錯誤代碼:', response.ErrCode);
  console.log('目前狀態:', response.CurrentState);
  console.log('授權碼:', response.AuthCode);
  console.log('授權金額:', response.AuthAmt);
  console.log('卡號:', response.PAN);           // 前六後四
  console.log('交易 ID:', response.XID);
}
```

### 退款 (posApiRefund)

```typescript
import { CTBCPosApiRefundParams } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const params: CTBCPosApiRefundParams = {
  MERID: '000100001234567',
  'LID-M': 'ORDER001',
  XID: 'TXN123456',                // 原交易 ID
  AuthCode: 'ABC123',              // 原授權碼
  OrgAmt: '1000',                  // 原交易金額
  PurchAmt: '500',                 // 退款金額
  currency: '901',                 // 可選: 幣別 (901=TWD)
  exponent: '0',                   // 可選: 小數位數
};

const response = await posApiRefund(config, params);
```

### 取消退款 (posApiCancelRefund)

```typescript
import { CTBCPosApiCancelRefundParams } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const params: CTBCPosApiCancelRefundParams = {
  MERID: '000100001234567',
  'LID-M': 'ORDER001',
  XID: 'TXN123456',
  AuthCode: 'ABC123',
  CredRevAmt: '500',               // 要取消的退款金額
  currency: '901',
  exponent: '0',
};

const response = await posApiCancelRefund(config, params);
```

### 授權取消 (posApiReversal)

用於取消尚未請款的授權交易。

```typescript
import { CTBCPosApiReversalParams } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const params: CTBCPosApiReversalParams = {
  MERID: '000100001234567',
  'LID-M': 'ORDER001',
  XID: 'TXN123456',
  AuthCode: 'ABC123',
  OrgAmt: '1000',                  // 原授權金額
  AuthNewAmt: '0',                 // 新授權金額 (0 表示全額取消)
  currency: '901',
  exponent: '0',
};

const response = await posApiReversal(config, params);
```

### 請款取消 (posApiCapRev)

用於取消已請款但尚未結帳的交易。

```typescript
import { CTBCPosApiCapRevParams } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const params: CTBCPosApiCapRevParams = {
  MERID: '000100001234567',
  'LID-M': 'ORDER001',
  XID: 'TXN123456',
  AuthCode: 'ABC123',
  OrgAmt: '1000',
  CapRevAmt: '0',                  // 取消請款金額 (0 表示全額)
  currency: '901',
  exponent: '0',
};

const response = await posApiCapRev(config, params);
```

### 智慧取消/退款 (posApiSmartCancelOrRefund)

自動根據交易狀態決定執行 Reversal、CapRev 或 Refund。

```typescript
const result = await posApiSmartCancelOrRefund(config, {
  MERID: '000100001234567',
  'LID-M': 'ORDER001',
  XID: 'TXN123456',
  AuthCode: 'ABC123',
  OrgAmt: '1000',
  PurchAmt: '1000',
  currency: '901',
  exponent: '0',
});

console.log('執行的動作:', result.action);  // 'Reversal' | 'CapRev' | 'Refund' | 'None' | 'Pending' | 'Failed' | 'Forbidden'
console.log('執行結果:', result.response);
console.log('查詢結果:', result.inquiry);
```

### 狀態判斷 (getPosNextActionFromInquiry)

根據查詢結果判斷下一步操作。

```typescript
import { getPosNextActionFromInquiry, PosAction } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const inquiry = await posApiQuery(config, { MERID: '...', 'LID-M': '...' });

if (typeof inquiry !== 'number') {
  const action: PosAction = getPosNextActionFromInquiry(inquiry);

  // CurrentState 對應:
  // -1: 授權失敗 → Failed
  //  0: 訂單已取消 → None
  //  1: 授權成功 → Reversal
  // 10: 已請款(處理中) → CapRev
  // 11: 已請款處理中 → Pending
  // 12: 已請款成功 → Refund
  // 13: 已請款失敗 → Failed
  // 20: 已退款(退款結帳中) → Forbidden
  // 21: 已退款(退款中) → Pending
  // 22: 已退款成功 → Forbidden
  // 23: 已退款失敗 → Failed
}
```

### PosAction 類型

```typescript
type PosAction = 'Reversal' | 'CapRev' | 'Refund' | 'None' | 'Pending' | 'Failed' | 'Forbidden';
```

---

## AMEX API (美國運通卡)

AMEX 交易使用獨立的 SOAP API。

### 設定

```typescript
import {
  amexInquiry,
  amexRefund,
  amexCancelRefund,
  amexAuthRev,
  amexCapRev,
  amexSmartCancelOrRefund,
  getAmexNextActionFromInquiry,
  CTBCAmexConfig,
} from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const config: CTBCAmexConfig = {
  wsdlUrl: 'https://testepos.ctbcbank.com/HubAgentConsole/services/AEPaymentSoap?wsdl',
  timeout: 30000,
  sslOptions: {
    key: 'CLIENT_PRIVATE_KEY',     // 可選
    cert: 'CLIENT_CERTIFICATE',    // 可選
    ca: 'CA_CERTIFICATE',          // 可選
    rejectUnauthorized: true,
  },
};
```

### 交易查詢 (amexInquiry)

```typescript
import { CTBCAmexInquiryParams } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const params: CTBCAmexInquiryParams = {
  merId: '123456789012',           // 商店代號 (最長 12 字元)
  lidm: 'ORDER001',                // 訂單編號 (最長 19 字元，英數字)
  xid: 'TXN123',                   // 可選: 交易 ID
  IN_MAC_KEY: 'YOUR_MAC_KEY',      // 可選: MAC Key (8 或 24 字元)
};

const response = await amexInquiry(config, params);

// 回應欄位 (統一為 CTBCPosApiResponse 格式)
console.log('回應代碼:', response.RespCode);
console.log('錯誤代碼:', response.ErrCode);        // A000 成功 -> 轉換為 00
console.log('授權碼:', response.AuthCode);
console.log('授權金額:', response.AuthAmt);
console.log('交易類型:', response.txnType);        // AU, VD, BQ, BV, RF, RV
console.log('狀態碼:', response.status);           // AP, VD, DC, B1-B6, RV, TO
```

### 退款 (amexRefund)

```typescript
import { CTBCAmexRefundParams } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const params: CTBCAmexRefundParams = {
  merId: '123456789012',
  lidm: 'ORDER001',
  xid: 'TXN123456',
  purchAmt: 500,                   // 退款金額 (數值)
  orgAmt: 1000,                    // 原交易金額
  IN_MAC_KEY: 'YOUR_MAC_KEY',
};

const response = await amexRefund(config, params);

// 額外回應欄位
console.log('AET ID:', response.aetId);
console.log('請款批次 ID:', response.capBatchId);
console.log('請款批次序號:', response.capBatchSeq);
```

### 取消退款 (amexCancelRefund / CredRev)

```typescript
import { CTBCAmexCancelRefundParams } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const params: CTBCAmexCancelRefundParams = {
  merId: '123456789012',
  lidm: 'ORDER001',
  xid: 'TXN123456',
  capBatchId: 'BATCH001',          // 請款批次 ID (8 字元)
  capBatchSeq: '000000000001',     // 請款批次序號 (12 字元)
  IN_MAC_KEY: 'YOUR_MAC_KEY',
};

const response = await amexCancelRefund(config, params);
```

### 授權取消 (amexAuthRev)

```typescript
import { CTBCAmexAuthRevParams } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const params: CTBCAmexAuthRevParams = {
  merId: '123456789012',
  lidm: 'ORDER001',
  xid: 'TXN123456',
  purchAmt: 1000,                  // 原交易金額
  orgAmt: 1000,
  IN_MAC_KEY: 'YOUR_MAC_KEY',
};

const response = await amexAuthRev(config, params);
```

### 請款取消 (amexCapRev)

```typescript
import { CTBCAmexCapRevParams } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const params: CTBCAmexCapRevParams = {
  merId: '123456789012',
  lidm: 'ORDER001',
  xid: 'TXN123456',
  purchAmt: 1000,
  orgAmt: 1000,
  IN_MAC_KEY: 'YOUR_MAC_KEY',
};

const response = await amexCapRev(config, params);
```

### 智慧取消/退款 (amexSmartCancelOrRefund)

自動根據交易狀態決定執行 AuthRev、CapRev 或 Refund。

```typescript
const result = await amexSmartCancelOrRefund(config, {
  merId: '123456789012',
  lidm: 'ORDER001',
  xid: 'TXN123456',
  purchAmt: 1000,
  orgAmt: 1000,
  IN_MAC_KEY: 'YOUR_MAC_KEY',
});

console.log('執行的動作:', result.action);  // 'AuthRev' | 'CapRev' | 'Refund' | 'None' | 'Pending' | 'Failed' | 'Forbidden'
console.log('執行結果:', result.response);
console.log('查詢結果:', result.inquiry);
```

### 狀態判斷 (getAmexNextActionFromInquiry)

```typescript
import { getAmexNextActionFromInquiry, AmexAction } from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const inquiry = await amexInquiry(config, { merId: '...', lidm: '...' });
const action: AmexAction = getAmexNextActionFromInquiry(inquiry);

// txnType 對應:
// AU: 授權交易
// VD: 取消授權
// BQ: 請款(轉入請款檔)
// BV: 請款取消
// RF: 退貨交易
// RV: 退款取消

// statusCode 對應:
// '  ' (空白): 等待授權回應 → Pending
// TO: 授權交易逾時 → Forbidden
// AP: 交易核准 → AuthRev
// VD: 訂單取消 → None
// DC: 交易拒絕 → Forbidden
// B1: 準備產生請款檔 → CapRev
// B2-B4: 請款處理中 → Pending
// B5: 請款成功 → Refund
// B6: 請款失敗 → Failed
// RV: 退貨取消 → Forbidden
```

### AmexAction 類型

```typescript
type AmexAction = 'AuthRev' | 'CapRev' | 'Refund' | 'None' | 'Failed' | 'Forbidden' | 'Pending';
```

---

## 完整範例

### 綁卡交易流程

```typescript
import express from 'express';
import {
  CTBCPayment,
  PaymentEvents,
} from '@rytass/payments-adapter-ctbc-micro-fast-pay';

const app = express();
app.use(express.urlencoded({ extended: true }));

const payment = new CTBCPayment({
  merchantId: process.env.CTBC_MERCHANT_ID!,
  merId: process.env.CTBC_MER_ID!,
  txnKey: process.env.CTBC_TXN_KEY!,
  terminalId: process.env.CTBC_TERMINAL_ID!,
  withServer: true,
  serverHost: 'http://localhost:3000',
});

// 監聽付款結果
payment.emitter.on(PaymentEvents.ORDER_COMMITTED, (order) => {
  console.log('付款成功:', order.id);
});

payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => {
  console.log('付款失敗:', order.id);
});

// 綁卡頁面
app.get('/bind-card/:memberId', async (req, res) => {
  const bindRequest = await payment.prepareBindCard(req.params.memberId);
  res.send(bindRequest.formHTML);
});

// 使用已綁定卡片結帳
app.post('/checkout', async (req, res) => {
  const order = await payment.checkoutWithBoundCard({
    memberId: req.body.memberId,
    cardId: req.body.cardToken,
    items: req.body.items,
  });

  res.json({ orderId: order.id });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 匯出項目

```typescript
// 類別
export { CTBCPayment } from './ctbc-payment';
export { CTBCOrder } from './ctbc-order';
export { CTBCBindCardRequest } from './ctbc-bind-card-request';

// 列舉
export {
  CTBCBindCardRequestState,
  CTBCOrderState,
} from './typings';

// 型別
export type {
  CTBCPosApiConfig,
  CTBCPosApiQueryParams,
  CTBCPosApiRefundParams,
  CTBCPosApiCancelRefundParams,
  CTBCPosApiResponse,
  CTBCAmexConfig,
  CTBCAmexInquiryParams,
  CTBCAmexRefundParams,
  CTBCAmexCancelRefundParams,
  CTBCAmexAuthRevParams,
  CTBCAmexCapRevParams,
} from './typings';

// POS API 工具函數
export {
  posApiQuery,
  posApiRefund,
  posApiCancelRefund,
  posApiReversal,
  posApiCapRev,
  posApiSmartCancelOrRefund,
  getPosNextActionFromInquiry,
} from './ctbc-pos-api-utils';

// AMEX SOAP 工具函數
export {
  amexInquiry,
  amexRefund,
  amexCancelRefund,
  amexAuthRev,
  amexCapRev,
  amexSmartCancelOrRefund,
  getAmexNextActionFromInquiry,
} from './ctbc-amex-api-utils';

// 重新匯出 @rytass/payments
export * from '@rytass/payments';
```

更多詳細資訊請參考 [CTBC 商店管理平台](https://epos.ctbcbank.com)。
