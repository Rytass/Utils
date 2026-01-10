# iCash Pay 愛金卡 - 完整參考文件

iCash Pay (愛金卡) 掃碼支付整合文件，支援 RSA + AES 雙重加密、POS 掃碼扣款與退款功能。

## 安裝

```bash
npm install @rytass/payments-adapter-icash-pay
```

## 初始化設定

```typescript
import { ICashPayPayment, ICashPayBaseUrls, LogLevel } from '@rytass/payments-adapter-icash-pay';

const payment = new ICashPayPayment({
  baseUrl: ICashPayBaseUrls.DEVELOPMENT,  // 必填：API 環境
  merchantId: 'YOUR_MERCHANT_ID',         // 必填：商戶 ID
  clientPrivateKey: `-----BEGIN RSA PRIVATE KEY-----
YOUR_CLIENT_PRIVATE_KEY
-----END RSA PRIVATE KEY-----`,           // 必填：客戶端私鑰（用於簽章）
  serverPublicKey: `-----BEGIN PUBLIC KEY-----
YOUR_SERVER_PUBLIC_KEY
-----END PUBLIC KEY-----`,                // 必填：伺服器公鑰（用於驗章）
  aesKey: {
    id: 'AES_KEY_ID',                     // 必填：AES 金鑰 ID
    key: '32_BYTES_AES_KEY_STRING',       // 必填：32 bytes AES-256 金鑰
    iv: '16_BYTES_IV_STRING',             // 必填：16 bytes IV
  },
  logLevel: LogLevel.INFO,                // 選填：日誌層級
});
```

### 初始化參數 (ICashPayPaymentInitOptions)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `baseUrl` | `ICashPayBaseUrls` | 是 | API 環境 URL |
| `merchantId` | `string` | 是 | 商戶 ID (PlatformID / MerchantID) |
| `clientPrivateKey` | `string` | 是 | RSA 私鑰（PEM 格式），用於簽章請求 |
| `serverPublicKey` | `string` | 是 | RSA 公鑰（PEM 格式），用於驗證回應 |
| `aesKey` | `ICashPayAESKey` | 是 | AES 加解密金鑰 |
| `logLevel` | `LogLevel` | 否 | 日誌層級（預設 ERROR） |

### 環境 URL (ICashPayBaseUrls)

```typescript
enum ICashPayBaseUrls {
  PRODUCTION = 'https://payment.icashpay.com.tw/api/V2/Payment',
  DEVELOPMENT = 'https://icp-payment-preprod.icashpay.com.tw/api/V2/Payment',
}
```

### AES 金鑰結構 (ICashPayAESKey)

```typescript
interface ICashPayAESKey {
  id: string;   // 金鑰 ID，用於 X-iCP-EncKeyID header
  key: string;  // 32 bytes AES-256 金鑰
  iv: string;   // 16 bytes 初始化向量
}
```

### 日誌層級 (LogLevel)

```typescript
enum LogLevel {
  ERROR = 1,  // 僅錯誤（預設）
  INFO = 2,   // 資訊 + 錯誤
  DEBUG = 4,  // 全部（包含敏感資料，僅供除錯）
}
```

## 加密機制

iCash Pay 使用 **RSA-SHA256 + AES-256-CBC** 雙重加密機制：

1. **AES-256-CBC 加密**: 使用 `aesKey.key` 和 `aesKey.iv` 加密請求資料
2. **RSA-SHA256 簽章**: 使用 `clientPrivateKey` 簽署加密後的資料
3. **回應驗章**: 使用 `serverPublicKey` 驗證回應的 `X-iCP-Signature`
4. **AES-256-CBC 解密**: 解密回應中的 `EncData`

## 核心概念

**重要**: iCash Pay 是 **POS 掃碼支付** 系統，運作方式如下：

1. 顧客在手機 App 產生條碼 (Barcode)
2. POS 機掃描顧客的條碼
3. 系統呼叫 `prepare()` 建立訂單
4. 呼叫 `order.commit()` 執行扣款

**不支援**：虛擬帳號、信用卡導向頁面、條碼生成等功能。`barcode` 參數是**顧客提供的條碼**，不是系統生成的。

## 準備訂單 (prepare)

### 準備訂單參數 (ICashPayPrepareOptions)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `barcode` | `string` | 是 | 顧客的條碼（掃描取得） |
| `storeName` | `string` | 是 | 門市名稱 |
| `amount` | `number` | 是 | 商品金額（元） |
| `items` | `ICashPayOrderItem[]` | 是 | 商品項目 |
| `id` | `string` | 否 | 訂單編號（未提供則自動產生） |
| `storeId` | `string` | 否 | 門市代碼 |
| `collectedAmount` | `number` | 否 | 代收金額 |
| `consignmentAmount` | `number` | 否 | 寄售金額 |
| `nonRedeemAmount` | `number` | 否 | 商品不可折抵金額 |
| `collectedNonRedeemAmount` | `number` | 否 | 代收不可折抵金額 |
| `consignmentNonRedeemAmount` | `number` | 否 | 寄售不可折抵金額 |
| `nonPointAmount` | `number` | 否 | 不累點金額 |

### 基本用法

```typescript
// 1. 掃描顧客條碼取得 barcode
const customerBarcode = '1234567890123456';  // 從 POS 掃描器取得

// 2. 準備訂單
const order = await payment.prepare({
  barcode: customerBarcode,
  storeName: '測試門市',
  amount: 100,  // 100 元
  items: [
    { name: '商品A', unitPrice: 100, quantity: 1 },
  ],
});

// 3. 提交扣款
await order.commit();

console.log('訂單編號:', order.id);
console.log('交易狀態:', order.state);
```

**注意**: `items` 的總金額必須等於 `amount + collectedAmount + consignmentAmount`。

### 含代收/寄售金額

```typescript
const order = await payment.prepare({
  barcode: customerBarcode,
  storeName: '測試門市',
  storeId: 'STORE001',
  amount: 800,              // 商品金額
  collectedAmount: 100,     // 代收金額（如水電費代收）
  consignmentAmount: 100,   // 寄售金額
  items: [
    { name: '商品', unitPrice: 800, quantity: 1 },
    { name: '水電費代收', unitPrice: 100, quantity: 1 },
    { name: '寄售商品', unitPrice: 100, quantity: 1 },
  ],
});

// 總金額 = 800 + 100 + 100 = 1000
await order.commit();
```

### 含不可折抵金額

```typescript
const order = await payment.prepare({
  barcode: customerBarcode,
  storeName: '測試門市',
  amount: 500,
  nonRedeemAmount: 100,      // 商品中 100 元不可用紅利折抵
  nonPointAmount: 50,        // 50 元不累積點數
  items: [
    { name: '商品', unitPrice: 500, quantity: 1 },
  ],
});

await order.commit();
```

## 提交訂單 (commit)

透過訂單物件的 `commit()` 方法執行扣款：

```typescript
const order = await payment.prepare({ ... });
await order.commit();

// commit 成功後可取得交易資訊
console.log('交易 ID:', order.transactionId);
console.log('付款金額:', order.paidAmount);
console.log('紅利金額:', order.bonusAmount);
```

### 回傳資訊 (ICashPayDeductResponsePayloadBody)

| 欄位 | 說明 |
|------|------|
| `TransactionID` | 交易 ID |
| `ICPAccount` | iCash Pay 帳號 |
| `TotalAmount` | 總金額（分） |
| `ICPAmount` | iCash Pay 支付金額（分） |
| `BonusAmt` | 紅利折抵金額（分） |
| `PaymentDate` | 付款時間 |
| `PaymentType` | 付款方式 |
| `MMemberID` | 會員 ID（若有綁定） |
| `MaskedPan` | 遮罩卡號（信用卡付款時） |
| `IsFiscTWQC` | 是否為台灣 Pay QR Code |
| `GID` | 統一編號（若有提供） |

## 查詢訂單 (query)

```typescript
const order = await payment.query('ORDER-001');

console.log('訂單編號:', order.id);
console.log('交易狀態:', order.state);
console.log('交易 ID:', order.transactionId);
console.log('付款金額:', order.paidAmount);
console.log('紅利金額:', order.bonusAmount);
console.log('是否已退款:', order.isRefunded);
console.log('付款方式:', order.paymentType);
```

### 訂單屬性

| 屬性 | 類型 | 說明 |
|------|------|------|
| `id` | `string` | 訂單編號 |
| `state` | `OrderState` | 訂單狀態 |
| `transactionId` | `string` | 交易 ID |
| `paidAmount` | `number` | 付款金額（元） |
| `bonusAmount` | `number` | 紅利折抵金額（元） |
| `isRefunded` | `boolean` | 是否已退款 |
| `paymentType` | `ICashPayPaymentType` | 付款方式 |
| `icpAccount` | `string` | iCash Pay 帳號 |
| `boundMemberId` | `string` | 綁定會員 ID |
| `invoiceMobileCarrier` | `string` | 手機載具 |
| `creditCardFirstSix` | `string` | 信用卡前六碼 |
| `creditCardLastFour` | `string` | 信用卡末四碼 |
| `isTWQRCode` | `boolean` | 是否為台灣 Pay QR Code |
| `twqrIssueCode` | `string` | 台灣 Pay 發行機構代碼 |
| `uniGID` | `string` | 統一編號 |

### 付款方式 (ICashPayPaymentType)

```typescript
enum ICashPayPaymentType {
  CREDIT_CARD = '0',  // 信用卡
  I_CASH = '1',       // iCash
  BANK = '2',         // 銀行帳戶
}
```

### 交易狀態 (ICashPayTradeStatus)

```typescript
enum ICashPayTradeStatus {
  INITED = '0',              // 初始化
  COMMITTED = '1',           // 已完成
  REFUNDED = '2',            // 已退款
  PARTIAL_REFUNDED = '3',    // 部分退款
  CANCELLED = '4',           // 已取消
  WAITING_SETTLEMENT = '5',  // 等待結算
  SETTLEMENT_FAILED = '6',   // 結算失敗
  FAILED = '7',              // 失敗
}
```

### 交易類型 (ICashPayTradeType)

```typescript
enum ICashPayTradeType {
  DEDUCT = '0',   // 扣款
  REFUND = '1',   // 退款
}
```

## 退款功能 (refund)

### 退款參數 (ICashPayRefundOptions)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `id` | `string` | 是 | 原交易訂單編號 (OMerchantTradeNo) |
| `transactionId` | `string` | 是 | 原交易的 TransactionID |
| `storeName` | `string` | 是 | 門市名稱 |
| `requestRefundAmount` | `number` | 是 | 商品退款金額（元） |
| `storeId` | `string` | 否 | 門市代碼 |
| `requestRefundCollectedAmount` | `number` | 否 | 代收退款金額（元） |
| `requestRefundConsignmentAmount` | `number` | 否 | 寄售退款金額（元） |
| `refundOrderId` | `string` | 否 | 退款訂單編號（未提供則自動產生） |

### 基本退款

```typescript
const refundOrder = await payment.refund({
  id: 'ORDER-001',                     // 原訂單編號
  transactionId: 'TXN123456789',       // 原交易 ID
  storeName: '測試門市',
  requestRefundAmount: 100,            // 退款 100 元
});

console.log('退款訂單編號:', refundOrder.id);
console.log('退款狀態:', refundOrder.state);
```

### 含代收/寄售退款

```typescript
const refundOrder = await payment.refund({
  id: 'ORDER-001',
  transactionId: 'TXN123456789',
  storeName: '測試門市',
  storeId: 'STORE001',
  requestRefundAmount: 800,            // 商品金額退款
  requestRefundCollectedAmount: 100,   // 代收金額退款
  requestRefundConsignmentAmount: 100, // 寄售金額退款
  refundOrderId: 'REFUND-001',         // 自訂退款訂單編號
});

// 總退款金額 = 800 + 100 + 100 = 1000
```

### 完整退款流程

```typescript
async function processRefund(originalOrderId: string, refundAmount: number) {
  // 1. 查詢原訂單取得 transactionId
  const originalOrder = await payment.query(originalOrderId);

  if (!originalOrder.transactionId) {
    throw new Error('找不到原交易 ID');
  }

  if (originalOrder.isRefunded) {
    throw new Error('訂單已退款');
  }

  // 2. 驗證退款金額
  if (refundAmount > originalOrder.paidAmount) {
    throw new Error('退款金額不可超過原交易金額');
  }

  // 3. 執行退款
  const refundOrder = await payment.refund({
    id: originalOrderId,
    transactionId: originalOrder.transactionId,
    storeName: '門市名稱',
    requestRefundAmount: refundAmount,
  });

  console.log('退款成功:', refundOrder.id);
  return refundOrder;
}
```

## 錯誤處理

```typescript
try {
  const order = await payment.prepare({ ... });
  await order.commit();
} catch (error) {
  // 錯誤格式: [RtnCode] RtnMsg
  console.error('扣款失敗:', error.message);
}
```

### 常見錯誤代碼

| RtnCode | 說明 |
|---------|------|
| `1` | 成功 (I_CASH_PAY_SUCCESS_CODE) |
| `-999` | 簽章驗證失敗 |
| 其他 | iCash Pay API 回傳的錯誤代碼 |

## 完整範例

```typescript
import {
  ICashPayPayment,
  ICashPayBaseUrls,
  LogLevel,
} from '@rytass/payments-adapter-icash-pay';

const payment = new ICashPayPayment({
  baseUrl: ICashPayBaseUrls.PRODUCTION,
  merchantId: process.env.ICASH_PAY_MERCHANT_ID!,
  clientPrivateKey: process.env.ICASH_PAY_CLIENT_PRIVATE_KEY!,
  serverPublicKey: process.env.ICASH_PAY_SERVER_PUBLIC_KEY!,
  aesKey: {
    id: process.env.ICASH_PAY_AES_KEY_ID!,
    key: process.env.ICASH_PAY_AES_KEY!,
    iv: process.env.ICASH_PAY_AES_IV!,
  },
  logLevel: LogLevel.INFO,
});

// POS 掃碼扣款流程
async function posDeduct(customerBarcode: string, amount: number) {
  // 1. 準備訂單
  const order = await payment.prepare({
    barcode: customerBarcode,
    storeName: '門市名稱',
    amount,
    items: [
      { name: '商品', unitPrice: amount, quantity: 1 },
    ],
  });

  // 2. 執行扣款
  await order.commit();

  console.log('交易成功');
  console.log('訂單編號:', order.id);
  console.log('交易 ID:', order.transactionId);
  console.log('付款金額:', order.paidAmount);
  console.log('紅利折抵:', order.bonusAmount);

  return order;
}

// 退款流程
async function posRefund(orderId: string) {
  const originalOrder = await payment.query(orderId);

  const refundOrder = await payment.refund({
    id: orderId,
    transactionId: originalOrder.transactionId!,
    storeName: '門市名稱',
    requestRefundAmount: originalOrder.paidAmount,
  });

  console.log('退款成功:', refundOrder.id);
  return refundOrder;
}
```

## 匯出項目

```typescript
// 類別
export { ICashPayPayment } from './icash-pay-payment';
export { ICashPayOrder } from './icash-pay-order';
export { ICashPayOrderItem } from './icash-pay-order-item';

// 型別與介面
export {
  ICashPayPaymentInitOptions,
  ICashPayAESKey,
  ICashPayPrepareOptions,
  ICashPayRefundOptions,
  ICashPayCommitMessage,
  ICashPayOrderInitOptions,
  ICashPayDeductRequestPayloadBody,
  ICashPayDeductResponsePayloadBody,
  ICashPayRefundRequestPayloadBody,
  ICashPayRefundResponsePayloadBody,
  ICashPayQueryRequestPayloadBody,
  ICashPayQueryResponsePayloadBody,
  ICashPayResponse,
} from './typing';

// 列舉
export {
  ICashPayBaseUrls,
  LogLevel,
  ICashPayTradeStatus,
  ICashPayTradeType,
  ICashPayPaymentType,
} from './typing';

// 常數
export { I_CASH_PAY_SUCCESS_CODE } from './typing';
```

更多詳細資訊請聯繫愛金卡公司取得技術文件。
