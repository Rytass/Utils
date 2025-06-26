# CTBC Micro Fast Pay Module 使用說明

本模組提供與中國信託 MicroFastPay 平台整合之完整流程，對齊 ECPay Adapter 設計，支援「信用卡綁定」與「PayJSON 請款」兩大功能，並內建事件監聽、MAC 驗證、TXN 加解密邏輯。

---

## 📌 目錄

- [模組總覽](#模組總覽)
- [綁卡流程](#綁卡流程)
- [請款流程](#請款流程)
- [事件監聽](#事件監聽)
- [介接說明](#介接說明)
- [補充說明](#補充說明)

---

## 模組總覽

```txt
CTBCPayment               // 主 Gateway，統一提供綁卡與請款服務
├─ createBindCardRequest  // 建立綁卡 Request，產生 form/formHTML
├─ handleBindCardCallback // 處理 CTBC 綁卡 callback
├─ createOrder            // 建立訂單並準備 commit
├─ emitter                // 派發事件：CARD_BOUND、ORDER_COMMITTED...
```

---

## 綁卡流程

1. 建立綁卡 request：

```ts
const bindCardRequest = payment.createBindCardRequest({
  MerID: 'MER00001',
  MemberID: 'U0000001',
  RequestNo: 'ORD20240624001',
  TokenURL: 'https://your.site/callback',
});
```

2. 將 `bindCardRequest.formHTML` 回傳給使用者（或導向 `bindingURL`）

3. 使用者完成綁卡後，CTBC 會將加密結果 POST 回 `TokenURL`

4. 在 callback handler 中解密並驗證：

```ts
payment.handleBindCardCallback(req.body.reqjsonpwd);
```

若綁卡成功，系統將觸發：

```ts
payment.emitter.on(PaymentEvents.CARD_BOUND, (request) => {
  console.log(request.cardId, request.cardNumberPrefix, request.bindingDate);
});
```

---

## 請款流程

1. 建立訂單（可綁背景訂閱、定期扣款）：

```ts
const order = payment.createOrder(
  'ORD20240624001', // RequestNo
  500, // PurchAmt
  'U0000001', // MemberID
  'CARDTOKEN123456', // 綁定卡片 token
);
```

2. 執行請款：

```ts
const result = await order.commit();

if (result.success) {
  console.log('請款成功，平台交易號：', result.orderNo);
} else {
  console.error('請款失敗:', result.error?.code, result.error?.message);
}
```

---

## 事件監聽

```ts
payment.emitter.on(PaymentEvents.CARD_BOUND, (req) => { ... });
payment.emitter.on(PaymentEvents.CARD_BINDING_FAILED, (req) => { ... });

payment.emitter.on(PaymentEvents.ORDER_COMMITTED, (order) => { ... });
payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => { ... });
```

---

## 介接說明

### 初始化 gateway

```ts
const payment = new CTBCPayment({
  merchantId: 'MER00001',
  txnKey: 'your-secret-key',
  baseUrl: 'https://ccapi.ctbcbank.com', // 預設為此，可略
  withServer: true, // 若需自動產生 bindingURL
});
```

### 快取使用說明

模組內部會自動將 `bindCardRequest` 暫存於記憶體中，待 callback 成功後刪除。你可依需求改為外部儲存。

---

## 補充說明

- 綁卡流程需使用者主動操作（網頁跳轉）
- 請款流程完全後台執行（背景定期請款可）
- 所有 TXN/MAC 已符合 CTBC 文件加解密邏輯
- 若需擴充查詢授權狀態、取消訂單，可依現有架構加掛 Command 類別
