# Logistics Adapters API Reference

## @rytass/logistics (Base Package)

### LogisticsService Interface

```typescript
interface LogisticsService<T extends LogisticsInterface<LogisticsStatus<T>>> {
  trace(request: string): Promise<LogisticsTraceResponse<T>[]>;
  trace(request: string[]): Promise<LogisticsTraceResponse<T>[]>;
}
```

### LogisticsInterface

```typescript
interface LogisticsInterface<T = LogisticsBaseStatus> {
  reference?: T;
  url: string;
}
```

### LogisticsTraceResponse

```typescript
interface LogisticsTraceResponse<K extends LogisticsInterface<LogisticsStatus<K>>> {
  logisticsId: string;
  statusHistory: LogisticsStatusHistory<K['reference']>[];
}

interface LogisticsStatusHistory<T> {
  date: string;
  status: T;
}
```

### LogisticsError

```typescript
class LogisticsError implements LogisticsErrorInterface {
  code: ErrorCode;
  message?: string;

  constructor(code: ErrorCode, message?: string);
}
```

### ErrorCode Enum

```typescript
enum ErrorCode {
  NOT_IMPLEMENTED = '999',   // 未實現
  NOT_FOUND_ERROR = '101',   // 找不到
  PERMISSION_DENIED = '102', // 權限被拒
  INVALID_PARAMETER = '103', // 無效參數
}
```

---

## @rytass/logistics-adapter-tcat

### TCatLogisticsService

```typescript
class TCatLogisticsService<T extends TCatLogisticsInterface<LogisticsStatus<T>>>
  implements LogisticsService<T> {

  constructor(configuration: T);

  trace(logisticsIds: string | string[]): Promise<LogisticsTraceResponse<T>[]>;
}
```

### TCatLogisticsInterface

```typescript
interface TCatLogisticsInterface<T> extends LogisticsInterface<T> {
  ignoreNotFound: boolean;
  statusMap: (html: string, id: string) => LogisticsStatusHistory<T>[];
}
```

### TCatLogisticsStatusHistory

```typescript
interface TCatLogisticsStatusHistory<T> extends LogisticsStatusHistory<T> {
  businessPremise: string;  // 營業所名稱
}
```

### TCatLogistics (預設設定)

```typescript
const TCatLogistics: TCatLogisticsInterface<TCatLogisticsStatus> = {
  ignoreNotFound: false,
  url: 'https://www.t-cat.com.tw/Inquire/TraceDetail.aspx',
  statusMap: defaultStatusMapFunction,
};
```

### TCatLogisticsStatus

```typescript
type TCatLogisticsStatus =
  | 'DELIVERED'          // 順利送達
  | 'TRANSPORTING'       // 轉運中
  | 'DELIVERING'         // 配送中
  | 'COLLECTING'         // 取件中
  | 'CONSOLIDATED'       // 已集貨
  | 'PICKUP_CANCELED'    // 取消取件
  | 'SHELVED'            // 暫置營業所
  | 'INVESTIGATING'      // 調查處理中
  | 'DELIVERING_TODAY'   // 配送中(當配下車)
  | 'FAIL_PICKUP'        // 未順利取件
  | 'AWAY_HOME';         // 不在家/公司休息
```

### 自訂 statusMap 範例

```typescript
import cheerio from 'cheerio';

const customLogistics: TCatLogisticsInterface<'DELIVERED' | 'DELIVERING'> = {
  ignoreNotFound: false,
  url: 'https://www.t-cat.com.tw/Inquire/TraceDetail.aspx',
  statusMap: (html: string, logisticId: string) => {
    const $ = cheerio.load(html);
    const statusHistory: LogisticsStatusHistory<'DELIVERED' | 'DELIVERING'>[] = [];

    $('#resultTable tr').each((index, element) => {
      if (index === 0) return;

      const cells = $(element).find('td');
      const date = $(cells[0]).text().trim();
      const statusText = $(cells[2]).text().trim();

      statusHistory.push({
        date,
        status: statusText === '順利送達' ? 'DELIVERED' : 'DELIVERING',
      });
    });

    return statusHistory;
  },
};
```

---

## @rytass/logistics-adapter-ctc

### CtcLogisticsService

```typescript
class CtcLogisticsService<T extends CtcLogisticsInterface<LogisticsStatus<T>>>
  implements LogisticsService<T> {

  constructor(configuration: T);

  // 追蹤
  trace(logisticsIds: string | string[]): Promise<LogisticsTraceResponse<T>[]>;

  // 訂單管理
  create(options: CreateOrUpdateCtcLogisticsOptions): Promise<CtcLogisticsDto>;
  update(options: CreateOrUpdateCtcLogisticsOptions): Promise<CtcLogisticsDto>;
}
```

### CtcLogisticsInterface

```typescript
interface CtcLogisticsInterface<T> extends LogisticsInterface<T> {
  url: string;
  apiToken: string;
  ignoreNotFound?: boolean;
}
```

### CtcLogistics (預設設定)

```typescript
const CtcLogistics: CtcLogisticsInterface<CtcLogisticsStatus> = {
  url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
  apiToken: 'YOUR_API_TOKEN',  // 需替換
  ignoreNotFound: true,
};
```

### CreateOrUpdateCtcLogisticsOptions

```typescript
interface CreateOrUpdateCtcLogisticsOptions {
  // 追蹤號碼（更新時必填）
  trackingNumber?: string;

  // 寄件人資訊
  senderCompany: string;           // 必填
  senderContactName?: string;
  senderAddress: string;           // 必填
  senderTel?: string;              // senderTel 或 senderMobile 至少一個
  senderMobile?: string;
  senderRemark?: string;

  // 收件人資訊
  receiverCompany: string;         // 必填
  receiverContactName: string;     // 必填
  receiverAddress: string;         // 必填
  receiverTel?: string;            // receiverTel 或 receiverMobile 至少一個
  receiverMobile?: string;
  receiverRemark?: string;

  // 配送資訊
  payCode: string;                 // 必填，付款代碼
  customerDepartmentId?: number;
  customerDepartmentUnitId?: number;

  // 可選（使用預設值）
  shipmentContent?: string;        // 預設: '貨件'
  transportation?: string;         // 預設: 'truck'
  shippingMethod?: string;         // 預設: 'land'
  payer?: string;                  // 預設: 'receiver'
  shippingTime?: string;           // 預設: 'regular'
  paymentMethod?: string;          // 預設: 'monthly'
  quantity?: number;               // 預設: 1
  weight?: number;                 // 預設: 1
  volume?: number;                 // 預設: 1
}
```

### CtcLogisticsDto

```typescript
interface CtcLogisticsDto {
  trackingNumber?: string;  // 查件單號
  shippingNumber: string;   // 託運單號
}
```

### CtcLogisticsStatus

```typescript
type CtcLogisticsStatus =
  | 'CREATED'              // 新單
  | 'PICKUP_EXCEPTION'     // 取件異常
  | 'PICKED_UP'            // 已取件
  | 'PICKUP_ARRIVED_AT_HUB' // 取件到站
  | 'IN_TRANSIT'           // 轉運中
  | 'TRANSIT_ARRIVED_AT_HUB' // 轉運到站
  | 'SHELVED'              // 回站保管
  | 'DELIVERING'           // 配送中
  | 'DELIVERY_EXCEPTION'   // 配送異常
  | 'DELIVERED'            // 配送完成
  | 'EMPTY_TRIP'           // 空趟
  | 'COMPLETED'            // 正常結案
  | 'NOTIFICATION_SENT'    // 通知完成
  | 'CANCELLED';           // 取消
```

### CtcLogisticsStatusEnum

```typescript
enum CtcLogisticsStatusEnum {
  CREATED = 10,
  PICKUP_EXCEPTION = 29,
  PICKED_UP = 30,
  PICKUP_ARRIVED_AT_HUB = 40,
  IN_TRANSIT = 50,
  TRANSIT_ARRIVED_AT_HUB = 60,
  SHELVED = 65,
  DELIVERING = 70,
  DELIVERY_EXCEPTION = 75,
  DELIVERED = 80,
  EMPTY_TRIP = 87,
  COMPLETED = 88,
  NOTIFICATION_SENT = 91,
  CANCELLED = 99,
}
```

---

## Complete Examples

### T-CAT 完整範例

```typescript
import {
  TCatLogisticsService,
  TCatLogistics,
  TCatLogisticsStatus,
} from '@rytass/logistics-adapter-tcat';
import { LogisticsError, ErrorCode } from '@rytass/logistics';

async function trackTCatPackages() {
  const logistics = new TCatLogisticsService(TCatLogistics);

  try {
    // 批量追蹤
    const results = await logistics.trace([
      '800978442950',
      '903404283301',
    ]);

    results.forEach(result => {
      console.log(`\n包裹 ${result.logisticsId}:`);

      result.statusHistory.forEach(history => {
        console.log(`  ${history.date}`);
        console.log(`    狀態: ${history.status}`);
        console.log(`    營業所: ${history.businessPremise}`);
      });

      // 取得最新狀態
      const latest = result.statusHistory[result.statusHistory.length - 1];
      if (latest.status === 'DELIVERED') {
        console.log('  ✓ 已送達');
      }
    });

  } catch (error) {
    if (error instanceof LogisticsError) {
      console.error(`錯誤代碼: ${error.code}, 訊息: ${error.message}`);
    }
  }
}
```

### CTC 完整範例

```typescript
import {
  CtcLogisticsService,
  CtcLogistics,
  CreateOrUpdateCtcLogisticsOptions,
} from '@rytass/logistics-adapter-ctc';
import { LogisticsError, ErrorCode } from '@rytass/logistics';

async function manageCtcShipment() {
  const logistics = new CtcLogisticsService({
    ...CtcLogistics,
    apiToken: process.env.CTC_API_TOKEN!,
    ignoreNotFound: false,
  });

  // 1. 建立託運單
  const createOptions: CreateOrUpdateCtcLogisticsOptions = {
    trackingNumber: `ORDER-${Date.now()}`,

    senderCompany: '發貨公司有限公司',
    senderContactName: '發貨人',
    senderAddress: '台北市中正區重慶南路一段122號',
    senderMobile: '0912345678',
    senderTel: '02-23456789',

    receiverCompany: '收貨公司有限公司',
    receiverContactName: '收貨人',
    receiverAddress: '台北市信義區信義路五段7號',
    receiverMobile: '0987654321',

    payCode: '客戶宅配',
    quantity: 2,
    weight: 5,
    shipmentContent: '電子產品',
  };

  try {
    const order = await logistics.create(createOptions);
    console.log('建立成功:', order);

    // 2. 追蹤包裹
    const [tracking] = await logistics.trace(order.trackingNumber!);
    console.log('追蹤結果:', tracking.statusHistory);

    // 3. 更新訂單
    const updatedOrder = await logistics.update({
      ...createOptions,
      trackingNumber: order.trackingNumber,
      receiverRemark: '請在下午配送',
    });
    console.log('更新成功:', updatedOrder);

  } catch (error) {
    if (error instanceof LogisticsError) {
      switch (error.code) {
        case ErrorCode.PERMISSION_DENIED:
          console.error('API Token 無效或無權限');
          break;
        case ErrorCode.INVALID_PARAMETER:
          console.error('參數錯誤:', error.message);
          break;
        default:
          console.error('未知錯誤:', error);
      }
    }
  }
}
```

---

## Dependency Matrix

| 套件 | 依賴 | 版本 |
|------|------|------|
| @rytass/logistics | - | - |
| @rytass/logistics-adapter-tcat | axios, cheerio | ^1.13.2, ^1.0.0 |
| @rytass/logistics-adapter-ctc | axios | ^1.13.2 |

## Integration Comparison

| 功能 | T-CAT | CTC |
|------|-------|-----|
| 追蹤方式 | HTML 爬蟲 | REST API |
| 認證 | 無 | API Token |
| 追蹤功能 | ✓ | ✓ |
| 批量追蹤 | ✓ | ✓ |
| 建立訂單 | ✗ | ✓ |
| 更新訂單 | ✗ | ✓ |
| 狀態數量 | 11 | 14 |
| 離線可用 | ✗ | ✗ |
