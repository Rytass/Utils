# Happy Card 統一禮物卡 - 完整參考文件

Happy Card (統一禮物卡) 支付整合文件，支援餘額查詢、金額+紅利雙支付、多筆記錄組合與退款功能。

## 安裝

```bash
npm install @rytass/payments-adapter-happy-card
```

## 初始化設定

```typescript
import { HappyCardPayment, HappyCardBaseUrls } from '@rytass/payments-adapter-happy-card';

const payment = new HappyCardPayment({
  cSource: 'YOUR_C_SOURCE',  // 必填：來源識別碼
  key: 'YOUR_KEY',           // 必填：API 金鑰
  baseUrl: HappyCardBaseUrls.DEVELOPMENT,  // 選填：預設為測試環境
  posId: '01',               // 選填：POS 機台編號
});
```

### 初始化參數 (HappyCardPaymentInitOptions)

| 參數 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `cSource` | `string` | 是 | - | 來源識別碼 |
| `key` | `string` | 是 | - | API 金鑰 |
| `baseUrl` | `HappyCardBaseUrls` | 否 | `DEVELOPMENT` | API 環境 URL |
| `posId` | `string` | 否 | `'01'` | POS 機台編號 |

### 環境 URL (HappyCardBaseUrls)

```typescript
enum HappyCardBaseUrls {
  PRODUCTION = 'https://prd-jp-posapi.azurewebsites.net/api/Pos',
  DEVELOPMENT = 'https://uat-pos-api.azurewebsites.net/api/Pos',
}
```

## 卡片餘額查詢 (getCardBalance)

`getCardBalance()` 方法支援兩種模式：簡易模式（僅回傳總餘額）和詳細模式（回傳所有記錄）。

### 簡易模式 - 取得總餘額

```typescript
// 回傳格式: [總餘額, 產品類型]
const [totalBalance, productType] = await payment.getCardBalance(
  '1234567890123456',  // 卡片序號 (cardSerial)
  false,               // returnRecords = false
  false,               // isIsland = false (選填，預設 false)
);

console.log('總餘額:', totalBalance);
console.log('產品類型:', productType);  // HappyCardProductType
```

### 詳細模式 - 取得所有記錄

```typescript
import {
  HappyCardRecord,
  HappyCardRecordType,
  HappyCardProductType
} from '@rytass/payments-adapter-happy-card';

// 回傳格式: [記錄陣列, 產品類型]
const [records, productType] = await payment.getCardBalance(
  '1234567890123456',  // 卡片序號
  true,                // returnRecords = true
  false,               // isIsland = false (選填)
);

// HappyCardRecord 結構
// {
//   id: number;         // 記錄 ID
//   type: HappyCardRecordType;  // 1: AMOUNT (金額), 2: BONUS (紅利)
//   amount: number;     // 可用金額或紅利點數
// }

records.forEach(record => {
  const typeLabel = record.type === HappyCardRecordType.AMOUNT ? '金額' : '紅利';
  console.log(`記錄 ${record.id}: ${typeLabel} = ${record.amount}`);
});
```

### 記錄類型 (HappyCardRecordType)

```typescript
enum HappyCardRecordType {
  AMOUNT = 1,  // 金額扣款
  BONUS = 2,   // 紅利扣點
}
```

### 產品類型 (HappyCardProductType)

```typescript
enum HappyCardProductType {
  INVOICE_FIRST_HAPPY_CARD_GF = '1',    // 開立發票 - Happy Card (GF)
  INVOICE_LATER_HAPPY_CARD_GS = '2',    // 後開發票 - Happy Card (GS)
  INVOICE_FIRST_DIGITAL_GIFT_GF = '3',  // 開立發票 - 數位禮物卡 (GF)
  INVOICE_LATER_DIGITAL_GIFT_GS = '4',  // 後開發票 - 數位禮物卡 (GS)
  INVOICE_FIRST_PHYSICAL_GIFT_GF = '5', // 開立發票 - 實體禮物卡 (GF)
  INVOICE_LATER_PHYSICAL_GIFT_GS = '6', // 後開發票 - 實體禮物卡 (GS)
}
```

### 離島區域查詢

```typescript
// 離島交易需設定 isIsland = true
const [balance, productType] = await payment.getCardBalance(
  '1234567890123456',
  false,
  true,  // isIsland = true
);
```

## 準備訂單 (prepare)

使用 `prepare()` 方法建立訂單，需指定卡片序號和使用記錄。

### 準備訂單參數 (HappyCardPayOptions)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `cardSerial` | `string` | 是 | 卡片序號 |
| `useRecords` | `HappyCardUseRecord[]` | 是 | 使用記錄清單 |
| `items` | `HappyCardOrderItem[]` | 是 | 商品項目 |
| `id` | `string` | 否 | 訂單編號（未提供則自動產生） |
| `posTradeNo` | `string` | 否 | POS 交易編號（最多 6 字元） |
| `uniMemberGID` | `string` | 否 | 統一會員 GID |
| `isIsland` | `boolean` | 否 | 是否為離島交易 |

### HappyCardUseRecord 結構

```typescript
interface HappyCardUseRecord {
  id: number;                    // 記錄 ID（來自 getCardBalance）
  type?: HappyCardRecordType;    // 記錄類型（預設 AMOUNT）
  amount: number;                // 使用金額
}
```

### 基本用法

```typescript
// 1. 先查詢卡片餘額取得記錄
const [records, productType] = await payment.getCardBalance(cardSerial, true);

// 2. 建立使用記錄
const useRecords = records
  .filter(r => r.amount > 0)
  .map(r => ({
    id: r.id,
    type: r.type,
    amount: r.amount,  // 或指定部分金額
  }));

// 3. 準備訂單
const order = await payment.prepare({
  cardSerial: '1234567890123456',
  useRecords,
  items: [
    { name: '商品A', unitPrice: 10000, quantity: 1 },
  ],
  posTradeNo: 'POS001',  // 選填，最多 6 字元
});

// 4. 提交訂單
await order.commit();
```

**注意**: `items` 的總金額必須與 `useRecords` 的總金額相等，否則會拋出錯誤。

### 完整餘額檢查與支付範例

```typescript
async function checkCardAndPay(cardSerial: string, requiredAmount: number) {
  // 取得詳細記錄以驗證餘額
  const [records, productType] = await payment.getCardBalance(cardSerial, true);

  // 計算總金額和總紅利
  const totalAmount = records
    .filter(r => r.type === HappyCardRecordType.AMOUNT)
    .reduce((sum, r) => sum + r.amount, 0);

  const totalBonus = records
    .filter(r => r.type === HappyCardRecordType.BONUS)
    .reduce((sum, r) => sum + r.amount, 0);

  console.log('可用金額:', totalAmount);
  console.log('可用紅利:', totalBonus);

  if (totalAmount + totalBonus < requiredAmount) {
    throw new Error('餘額不足');
  }

  // 建立使用記錄（優先使用紅利）
  let remaining = requiredAmount;
  const useRecords: HappyCardUseRecord[] = [];

  // 先用紅利
  for (const record of records.filter(r => r.type === HappyCardRecordType.BONUS)) {
    if (remaining <= 0) break;
    const useAmount = Math.min(record.amount, remaining);
    useRecords.push({ id: record.id, type: record.type, amount: useAmount });
    remaining -= useAmount;
  }

  // 不足部分用金額
  for (const record of records.filter(r => r.type === HappyCardRecordType.AMOUNT)) {
    if (remaining <= 0) break;
    const useAmount = Math.min(record.amount, remaining);
    useRecords.push({ id: record.id, type: record.type, amount: useAmount });
    remaining -= useAmount;
  }

  // 準備並提交訂單
  const order = await payment.prepare({
    cardSerial,
    useRecords,
    items: [{ name: '商品', unitPrice: requiredAmount, quantity: 1 }],
  });

  await order.commit();
  return order;
}
```

## 提交訂單 (commit)

訂單物件的 `commit()` 方法會呼叫 gateway 的 `commit()` 執行實際扣款。

```typescript
const order = await payment.prepare({ ... });
await order.commit();
```

### Gateway commit 參數 (HappyCardCommitOptions)

**注意**: 一般使用時透過 `order.commit()` 呼叫，不需直接呼叫 `payment.commit()`。

```typescript
interface HappyCardCommitOptions {
  payload: Omit<HappyCardPayRequest, 'basedata'>;
  isIsland?: boolean;
}
```

## 退款功能 (refund)

使用 `refund()` 方法進行退款，需提供原訂單的 ID 和卡片序號。

### 退款參數 (HappyCardRefundOptions)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `id` | `string` | 是 | 原訂單編號 (request_no) |
| `cardSerial` | `string` | 是 | 卡片序號 |
| `posTradeNo` | `string` | 否 | POS 交易編號 |
| `isIsland` | `boolean` | 否 | 是否為離島交易 |

### 退款範例

```typescript
await payment.refund({
  id: 'ORDER-001',           // 原訂單編號
  cardSerial: '1234567890123456',
  posTradeNo: 'POS001',      // 選填
  isIsland: false,           // 選填
});
```

**注意**: Happy Card 的退款是**整筆取消**，不支援部分退款。

## 查詢訂單 (query)

**注意**: `query()` 方法目前**未實作**，會拋出 `'Method not implemented.'` 錯誤。

```typescript
// 以下程式碼會拋出錯誤
const order = await payment.query('ORDER-001');  // Error: Method not implemented.
```

## 結果代碼 (HappyCardResultCode)

```typescript
enum HappyCardResultCode {
  FAILED = '0',   // 失敗
  SUCCESS = '1',  // 成功
}
```

## 完整範例

```typescript
import {
  HappyCardPayment,
  HappyCardBaseUrls,
  HappyCardRecordType,
  HappyCardUseRecord,
} from '@rytass/payments-adapter-happy-card';

const payment = new HappyCardPayment({
  cSource: process.env.HAPPY_CARD_C_SOURCE!,
  key: process.env.HAPPY_CARD_KEY!,
  baseUrl: HappyCardBaseUrls.PRODUCTION,
});

// 完整付款流程
async function processPayment(cardSerial: string, totalAmount: number) {
  // 1. 查詢卡片餘額
  const [records, productType] = await payment.getCardBalance(cardSerial, true);

  // 2. 計算可用餘額
  const availableBalance = records.reduce((sum, r) => sum + r.amount, 0);

  if (availableBalance < totalAmount) {
    throw new Error('餘額不足');
  }

  // 3. 建立使用記錄
  let remaining = totalAmount;
  const useRecords: HappyCardUseRecord[] = [];

  for (const record of records) {
    if (remaining <= 0) break;
    const useAmount = Math.min(record.amount, remaining);
    useRecords.push({
      id: record.id,
      type: record.type,
      amount: useAmount,
    });
    remaining -= useAmount;
  }

  // 4. 準備訂單
  const order = await payment.prepare({
    cardSerial,
    useRecords,
    items: [
      { name: '商品', unitPrice: totalAmount, quantity: 1 },
    ],
  });

  // 5. 提交訂單
  await order.commit();

  console.log('交易成功，訂單編號:', order.id);

  return order;
}

// 退款流程
async function processRefund(orderId: string, cardSerial: string) {
  await payment.refund({
    id: orderId,
    cardSerial,
  });

  console.log('退款成功');
}
```

## 匯出項目

```typescript
// 類別
export { HappyCardPayment } from './happy-card-payment';
export { HappyCardOrder } from './happy-card-order';
export { HappyCardOrderItem } from './happy-card-order-item';

// 型別與介面
export {
  HappyCardPaymentInitOptions,
  HappyCardPayOptions,
  HappyCardUseRecord,
  HappyCardRecord,
  HappyCardCommitOptions,
  HappyCardRefundOptions,
  HappyCardCommitMessage,
  HappyCardAPIBaseData,
  HappyCardPayRequest,
  HappyCardPayResponse,
  HappyCardSearchCardRequest,
  HappyCardSearchCardResponse,
  HappyCardRefundRequest,
  HappyCardRefundResponse,
} from './typings';

// 列舉
export {
  HappyCardRecordType,
  HappyCardProductType,
  HappyCardBaseUrls,
  HappyCardResultCode,
} from './typings';
```

更多詳細資訊請聯繫統一禮物卡公司取得技術文件。
