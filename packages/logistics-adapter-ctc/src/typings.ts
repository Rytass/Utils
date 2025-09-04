import { LogisticsInterface, LogisticsStatusHistory } from '@rytass/logistics';

export enum CtcLogisticsStatusEnum {
  CREATED = 10, // 新單
  PICKUP_EXCEPTION = 29, // 取件異常
  PICKED_UP = 30, // 已取件
  PICKUP_ARRIVED_AT_HUB = 40, // 取件到站
  IN_TRANSIT = 50, // 轉運中
  TRANSIT_ARRIVED_AT_HUB = 60, // 轉運到站
  SHELVED = 65, // 回站保管
  DELIVERING = 70, // 配送中
  DELIVERY_EXCEPTION = 75, // 配送異常
  DELIVERED = 80, // 配送完成
  EMPTY_TRIP = 87, // 空趟
  COMPLETED = 88, // 正常結案
  NOTIFICATION_SENT = 91, // 通知完成
  CANCELLED = 99, // 取消
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
};

export interface CreateOrUpdateCtcLogisticsOptions {
  trackingNumber?: string; // 查件單號, primary key
  customerDepartmentId?: number; // 客戶部門ID, optional
  customerDepartmentUnitId?: number; // 客戶部門單位ID, optional

  senderCompany: string; // 寄件人公司名稱
  senderContactName?: string; // 寄件人聯絡人
  senderAddress: string; // 寄件人地址
  senderTel?: string; // 寄件人市話
  senderMobile?: string; // 寄件人手機
  senderRemark?: string; // 寄件人備註

  receiverCompany: string; // 收件人公司名稱
  receiverContactName: string; // 收件人聯絡人
  receiverAddress: string; // 收件人地址
  receiverTel?: string; // 收件人市話
  receiverMobile?: string; // 收件人手機
  receiverRemark?: string; // 收件人備註

  shipmentContent?: string; // 貨物內容, 固定為 '貨件'
  transportation?: string; // 運輸工具, 固定為 'truck'
  shippingMethod?: string; // 運送方式, 固定為 'land'
  payer?: string; // 費用支付方, 固定為 'sender'
  shippingTime?: string; // 送件時效, 固定為 'regular'
  paymentMethod?: string; // 結算方式, 固定為 'monthly'
  quantity?: number; // 件數, 固定為 1
  weight?: number; // 重量, 固定為 1
  volume?: number; // 材積, 固定為 1
}

export interface CtcLogisticsDto {
  trackingNumber?: string; // 查件單號
  shippingNumber: string; // 托運單號
}

export interface CreateOrUpdateCtcLogisticsRequest {
  order: {
    tracking_number?: string; // 查件單號
    customer_department_id?: number; // 客戶部門ID, optional
    customer_department_unit_id?: number; // 客戶部門單位ID, optional

    sender_company: string; // 寄件人公司名稱
    sender_contact_name: string; // 寄件人聯絡人
    sender_tel?: string; // 寄件人市話
    sender_mobile?: string; // 寄件人手機
    sender_address: string; // 寄件人地址
    sender_remark?: string; // 寄件人備註

    receiver_company: string; // 收件人公司名稱
    receiver_contact_name: string; // 收件人聯絡人
    receiver_tel?: string; // 收件人市話
    receiver_mobile?: string; // 收件人手機
    receiver_address: string; // 收件人地址
    receiver_remark?: string; // 收件人備註

    shipment_content: string; // 貨物內容 * 固定為 '貨件'
    transportation: string; // 運輸工具 * 固定為 'truck'
    shipping_method: string; // 運送方式 * 固定為 'land'
    payer: string; // 費用支付方 * 固定為 'sender'
    shipping_time: string; // 送件時效 * 固定為 'regular'
    payment_method: string; // 結算方式 * 固定為 'monthly'
    quantity: number; // 件數 * 固定為 1
    weight: number; // 重量 * 固定為 1
    volume: number; // 材積 * 固定為 1
  };
}

export interface CreateOrUpdateCtcLogisticsResponse {
  success: boolean; // 是否成功
  shipping_number: string; // 托運單號
  tracking_number?: string; // 查件單號
}
