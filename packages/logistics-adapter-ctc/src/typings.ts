import { LogisticsInterface, LogisticsStatusHistory } from '@rytass/logistics';

export enum CtcLogisticsStatusEnum {
  CREATED = 10,                      // 新單
  PICKUP_EXCEPTION = 29,             // 取件異常
  PICKED_UP = 30,                    // 已取件
  PICKUP_ARRIVED_AT_HUB = 40,        // 取件到站
  IN_TRANSIT = 50,                   // 轉運中
  TRANSIT_ARRIVED_AT_HUB = 60,       // 轉運到站
  SHELVED = 65,                      // 回站保管
  DELIVERING = 70,                   // 配送中
  DELIVERY_EXCEPTION = 75,           // 配送異常
  DELIVERED = 80,                    // 配送完成
  EMPTY_TRIP = 87,                   // 空趟
  COMPLETED = 88,                    // 正常結案
  NOTIFICATION_SENT = 91,            // 通知完成
  CANCELLED = 99,                    // 取消
}

export type CtcLogisticsStatus =
  | 'CREATED'
  | 'PICKUP_EXCEPTION'
  | 'PICKED_UP'
  | 'PICKUP_ARRIVED_AT_HUB'
  | 'IN_TRANSIT'
  | 'TRANSIT_ARRIVED_AT_HUB'
  | 'SHELVED'
  | 'DELIVERING'
  | 'DELIVERY_EXCEPTION'
  | 'DELIVERED'
  | 'EMPTY_TRIP'
  | 'COMPLETED'
  | 'NOTIFICATION_SENT'
  | 'CANCELLED';

export interface CtcLogisticsInterface<T> extends LogisticsInterface<T> {
  apiToken: string;
  ignoreNotFound?: boolean;
}

export interface CtcLogisticsStatusHistory<T> extends LogisticsStatusHistory<T> {
  statusCode: CtcLogisticsStatusEnum;
}

export const CtcLogisticsStatusMap: { [key: string]: CtcLogisticsStatus } = {
  新單: 'CREATED',
  取件異常: 'PICKUP_EXCEPTION',
  已取件: 'PICKED_UP',
  取件到站: 'PICKUP_ARRIVED_AT_HUB',
  轉運中: 'IN_TRANSIT',
  轉運到站: 'TRANSIT_ARRIVED_AT_HUB',
  回站保管: 'SHELVED',
  配送中: 'DELIVERING',
  配送異常: 'DELIVERY_EXCEPTION',
  配送完成: 'DELIVERED',
  空趟: 'EMPTY_TRIP',
  正常結案: 'COMPLETED',
  通知完成: 'NOTIFICATION_SENT',
  取消: 'CANCELLED',
};

export const CtcLogistics: CtcLogisticsInterface<CtcLogisticsStatus> = {
  url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
  apiToken: 'c5a41fd4ab87598f47eda26c7c54f512',
  ignoreNotFound: true,
}
