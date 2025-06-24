# CTBC 綁卡流程實作進度圖（截至目前）

本流程對應 CTBC MicroFastPay 文件的「5.4 新增卡片」與「4.2.1 綁卡結果回傳」，整體目標是對齊 ECPay 綁卡流程的開發接口，實現一樣的使用方式與事件流程。

---

## 🧭 綁卡流程總覽

```text
綁卡流程起點
└─> CTBCPayment.createBindCardRequest()
      └─> 建立 CTBCBindCardRequest 實例
              └─(constructor)
              └─[form] => 產生加密 reqjsonpwd 參數
                          → buildReqjsonpwd()
                            └─ getMAC(), getTXN() @ ctbc-crypto-core
                            └─ JSON+Base64+Hex encode
                          → 加入 form 隱藏欄位

              └─[formHTML] => 包裝 HTML form，自動跳轉
                          → 使用 gateway.endpoint 組成 POST action

表單送出
└─> 客戶端導向 CTBC 綁卡頁

綁卡完成（callback from CTBC）
└─> CTBCPayment.handleBindCardCallback(rspjsonpwd)
      └─> parseRspjsonpwd() @ ctbc-response.ts
      └─> validateRspjsonpwdMAC()
      └─> 取出 request = bindCardRequestsCache.get(RequestNo)
          ├─ payload.StatusCode === '00'
          │   └─> request.bound(payload)
          │         └─ 更新 cardId, 卡號頭尾, 綁定時間
          │         └─ emit PaymentEvents.CARD_BOUND
          └─ else
              └─> request.fail(...)
                    └─ emit PaymentEvents.CARD_BINDING_FAILED
```

---

## 📁 檔案職責一覽

| 檔案路徑                            | 功能說明                            |
|-------------------------------------|-------------------------------------|
| `ctbc-payment.ts`                   | 綁卡 gateway 主類別，註冊請求、處理 callback |
| `ctbc-bind-card-request.ts`         | 對應單一綁卡請求物件，封裝狀態與 HTML 產出 |
| `ctbc-crypto-core.ts`               | 提供 getTXN, getMAC 加解密邏輯 (3DES, SHA256) |
| `ctbc-crypto.ts`                    | 實作 buildReqjsonpwd，加密組包轉 base64+hex |
| `ctbc-response.ts`                  | 實作 parseRspjsonpwd、validateRspjsonpwdMAC |
| `typings.ts`                        | 定義 CTBC 綁卡所用所有型別資料結構 |

---

## ✅ 已完成功能清單

- [x] 綁卡表單產出（含 reqjsonpwd 加密）
- [x] 綁卡 HTML 自動送出
- [x] 綁卡 callback 資料解析與驗證
- [x] 綁卡狀態記錄、綁定時間、卡號顯示等欄位
- [x] 事件派發：CARD_BOUND / CARD_BINDING_FAILED
- [x] 對齊 ECPay API 行為接口
