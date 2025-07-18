# NewebPay TCC Adapter 使用說明

本模組提供與藍新金流 NewebPay 平台整合之信用卡綁定與約定付款（TCC）流程，支援首次綁卡、定期或非定期付款、查詢、解綁，並支援事件導向開發模式，與 CTBC Adapter 結構一致。

---

## 📌 目錄

- [模組總覽](#模組總覽)
- [初始化說明](#初始化說明)
- [綁卡流程](#綁卡流程)
- [付款流程](#付款流程)
- [查詢與解綁](#查詢與解綁)
- [事件監聽](#事件監聽)

---

## 模組總覽

```ts
NewebPayPayment             // 主 Gateway，統一提供綁卡與付款服務
├─ createBindCardRequest    // 建立綁卡 Request，產生 form/formHTML
├─ handleBindCardCallback   // 處理 NewebPay 綁卡 callback
├─ createOrder              // 建立訂單並準備 commit
├─ queryBindCard            // 查詢指定 Token 是否有效
├─ unbindCard               // 解綁卡片
├─ emitter                  // 派發事件：CARD_BOUND、ORDER_COMMITTED...
```

---

## 初始化說明

```ts
const payment = new NewebPayPayment({
  merchantId: 'YourMerchantID',
  aesKey: 'YourKeyFromNewebPay',
  aesIv: 'YourIVFromNewebPay',
  encryptType: 0, // 0 = CBC, 1 = GCM
});
```

---

## 綁卡流程

> 首次授權

1. 建立綁卡請求：

```ts
const bindCardRequest = payment.createBindCardRequest({
  MerchantID: 'YourMerchantID',
  Version: '1.0',
  RespondType: 'JSON',
  TimeStamp: Date.now().toString(),
  MerchantOrderNo: 'ORD20240718001',
  Amt: 1,
  Email: 'user@example.com',
  LoginType: 0,
  TokenTerm: 'U0001',
  TokenLife: 9999,
  NotifyURL: 'https://your.site/callback',
});
```

2. 將 `bindCardRequest.formHTML` 回傳前端，直接跳轉 NewebPay 綁卡畫面。

3. 綁卡完成後，NewebPay 將以 POST 傳送 `TradeInfo`, `TradeSha` 至 `NotifyURL`

4. 後端處理 callback：

```ts
await payment.handleBindCardCallback(tradeInfo, tradeSha);
```

5. 成功後觸發事件：

```ts
payment.emitter.on(PaymentEvents.CARD_BOUND, (request) => {
  console.log(request.tokenValue, request.cardNumberPrefix, request.bindingDate);
});
```

---

## 付款流程

> 後續約定付款

1. 建立付款訂單：

```ts
const order = payment.createOrder({
  MerchantOrderNo: 'ORD20240718099',
  Amt: 500,
  ItemDesc: '月費扣款',
  Email: 'user@example.com',
  TokenValue: 'TOKENXXXXXX',
  TokenTerm: 'U0001',
});
```

2. 執行請款：

```ts
const result = await order.executeCommit();

if (result.success) {
  console.log('請款成功，交易號：', result.orderNo);
} else {
  console.error('請款失敗：', result.error?.code, result.error?.message);
}
```

---

## 查詢與解綁

### 查詢綁卡狀態

```ts
const card = await payment.queryBindCard('U0001', 'TOKENXXXXXX');

console.log(card.card6No, card.card4No, card.valid, card.tokenSwitch);
```

### 解綁卡片

```ts
const result = await payment.unbindCard('U0001', 'TOKENXXXXXX');

console.log(result.success); // true / false
```

---

## 事件監聽

```ts
payment.emitter.on(PaymentEvents.CARD_BOUND, (request) => { ... });
payment.emitter.on(PaymentEvents.CARD_BINDING_FAILED, (request) => { ... });

payment.emitter.on(PaymentEvents.ORDER_COMMITTED, (order) => { ... });
payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => { ... });
```

---

## 備註

- 綁卡流程屬一次性綁定，需由前端引導跳轉 NewebPay 頁面。
- 綁卡完成後可使用 `TokenValue` 執行背景請款或排程扣款。
- 僅支援幕後 API（NPA-B101 / B102 / B103 / B104）與前台 P1（NPA-F011）。
