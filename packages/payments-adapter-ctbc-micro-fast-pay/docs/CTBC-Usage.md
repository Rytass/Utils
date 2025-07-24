# CTBC Micro Fast Pay Module 使用說明

本模組提供與 CTBC MicroFastPay 平台整合之完整流程，對齊 ECPay Adapter 設計，支援「信用卡綁定」與「PayJSON 請款」兩大功能，並內建事件監聽、MAC 驗證、TXN 加解密邏輯。

## 📌 目錄

- [模組總覽](#模組總覽)
- [綁卡流程](#綁卡流程)
- [請款流程](#請款流程)
- [事件監聽](#事件監聽)
- [介接說明](#介接說明)
- [補充說明](#補充說明)

---

## 模組總覽

```ts
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
  MerID: 'MER00001',                       // 銀行提供之網站代號，與 MerchantID 不同
  MemberID: 'U0000001',                    // 自定義會員代號（不得為電話/E-mail 等敏感資訊）
  RequestNo: 'ORD20240624001',             // 請求編號（需唯一）
  TokenURL: 'https://your.site/callback',  // 綁卡完成後的 callback URL
});
```

2. 將 `bindCardRequest.formHTML` 回傳前端（或導向 `bindingURL`）

3. CTBC 完成綁卡後，會以 POST 將電文回傳至 `TokenURL`

4. 後端解密並處理：

handleBindCardCallback 行為由初始化 gateway 時的 `requireCacheHit` 參數控制，預設為 `true`，表示此 callback 必須對應到先前建立的綁卡請求，否則會拋出錯誤。

```ts
payment.handleBindCardCallback(req.body.reqjsonpwd);
```

> 若你希望允許 fallback 行為（例如 callback 無對應快取但仍需處理），可在 `CTBCPayment` 初始化時將 `requireCacheHit` 設為 `false`。

5. 成功後觸發事件：

```ts
payment.emitter.on(PaymentEvents.CARD_BOUND, (request) => {
  console.log(request.cardId, request.cardNumberPrefix, request.bindingDate);
});
```

---

## 請款流程

1. 建立訂單（亦可用於排程背景扣款）：

```ts
const order = payment.createOrder(
  'ORD20240624001',        // RequestNo
  500,                     // PurchAmt
  'U0000001',              // MemberID
  'CARDTOKEN123456',       // 綁定卡片的 CardToken
);
```

2. 執行請款：

```ts
const result = await order.executeCommit();

if (result.success) {
  console.log('請款成功，平台交易號：', result.orderNo);
} else {
  console.error('請款失敗:', result.error?.code, result.error?.message);
}
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

## 介接說明

### 初始化 gateway

```ts
const payment = new CTBCPayment({
  merchantId: 'MER00001',                 // 與 CTBC 申請的特店代碼（非 TXN 中的 MerID）
  txnKey: process.env.CTBC_KEY,           // 壓碼設定時輸入的明碼（MchKey，24 碼）
  baseUrl: 'https://ccapi.ctbcbank.com',  // 可省略
  withServer: true,                       // 若需自動產生 bindingURL，可設 true
});
```

### 注意事項

- `txnKey` 必須妥善保管，建議使用 secrets manager 儲存。

- 綁卡請求送出後，會暫存在記憶體（僅限應用程式執行期間），用於 callback 對應與驗證。
- 若使用分散式部署，請確保 callback 導向原節點，或改用共享快取。

---

## 補充說明

- 🔐 **txnKey（MchKey）來源**：來自 CTBC EzPos 後台壓碼設定，24 碼明碼字串。
- 🔎 **rspjsonpwd 解碼流程**：
  1. 十六進位解碼 → base64 解碼 → JSON.parse
  2. 解開 `TXN` 並驗證 MAC → 拿到原始欄位物件
- ⚠️ **錯誤排查方式**：
  - `StatusCode !== 'I0000'` 表示請款失敗，常見如：
    - `E9998`: 未定義錯誤類型（CTBC 回傳 `ERROR_UNDEFINED`）
  - `MAC_FAIL`： 回傳資料經本地 MAC 驗證不符（非 CTBC StatusCode）

---

## 📎 常見錯誤對照表（部分）

| 錯誤代碼 | 說明               |
|----------|------------------|
| I0000    | 交易成功          |
| E0029    | 卡號格式錯誤      |
| E9998    | 未定義錯誤類型     |
| MAC_FAIL | 回傳驗證失敗      |
