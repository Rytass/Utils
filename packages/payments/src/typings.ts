import { EventEmitter } from 'events';

export interface PaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface PrepareOrderInput {
  items: PaymentItem[];
}

export interface OrderCreditCardCommitMessage extends OrderCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date;
}

export interface OrderVirtualAccountCommitMessage extends OrderCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

export interface OrderCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

type IsExtends<OCM, CheckTarget, Result> = OCM extends CheckTarget ? Result : never;

export type AdditionalInfo<OCM extends OrderCommitMessage> = IsExtends<OCM, OrderCreditCardCommitMessage, CreditCardAuthInfo> extends never
  ? IsExtends<OCM, OrderVirtualAccountCommitMessage, VirtualAccountInfo> extends never
  ? never
  : VirtualAccountInfo
  : CreditCardAuthInfo;

export interface Order<OCM extends OrderCommitMessage> extends PrepareOrderInput {
  // Order State
  state: OrderState;

  // Order created at (send to gateway time)
  createdAt: Date | null;

  // Order committed at
  committedAt: Date | null;

  // Additional info
  additionalInfo?: AdditionalInfo<OCM>;

  id: string;
  items: PaymentItem[];
  commitable: boolean;
  commit<T extends OCM>(message: T): void;
}

type InputTypeCheck<OCM extends OrderCommitMessage, CheckTarget extends OrderCommitMessage, Result extends PrepareOrderInput> = OCM extends (infer U) ? U extends CheckTarget ? Result : never : never;
type InputTypeCheck2<OCM extends OrderCommitMessage, CheckTarget extends OrderCommitMessage, Result extends PrepareOrderInput> = OCM extends (infer U) ? U extends CheckTarget ? Result : never : never;

type InputFromOrderCommitMessage<OCM extends OrderCommitMessage> = PrepareOrderInput;

export interface PaymentGateway<
  OCM extends OrderCommitMessage,
  O extends Order<OCM>,
> {
  emitter: EventEmitter;

  prepare<N extends OCM>(input: InputFromOrderCommitMessage<OCM>): Order<N>;

  query<Order extends O>(id: string): Promise<Order>;
}

export enum Channel {
  CREDIT_CARD = 'CREDIT_CARD',
  WEB_ATM = 'WEB_ATM',
  VIRTUAL_ACCOUNT = 'VIRTUAL_ACCOUNT',
  CVS_KIOSK = 'CVS_KIOSK',
  CVS_BARCODE = 'CVS_BARCODE',
}

export enum CreditCardECI {
  MASTER_3D = '2',
  MASTER_3D_PART = '1',
  MASTER_3D_FAILED = '0',
  VISA_AE_JCB_3D = '5',
  VISA_AE_JCB_3D_PART = '6',
  VISA_AE_JCB_3D_FAILED = '7',
}

export interface CreditCardAuthInfo {
  processDate: Date;
  authCode: string; // Credit Card Auth Code (6 digits)
  amount: number;
  eci: CreditCardECI;
  card4Number: string;
  card6Number: string;
}

export interface VirtualAccountInfo {
  bankCode: string;
  account: string;
}

export enum OrderState {
  INITED = 'INITED',
  PRE_COMMIT = 'PRE_COMMIT', // Created
  COMMITTED = 'COMMITTED', // Fulfilled
  FAILED = 'FAILED',
}

export enum PaymentEvents {
  SERVER_LISTENED = 'LISTENED',
  ORDER_PRE_COMMIT = 'PRE_COMMIT',
  ORDER_COMMITTED = 'COMMITTED',
}

export interface ECPayQueryOrderPayload extends Record<string, string> {
  MerchantID: string;
  MerchantTradeNo: string;
  TimeStamp: string;
  PlatformID: string;
  CheckMacValue: string;
}

export enum PaymentPeriodType {
  DAY = 'D',
  MONTH = 'M',
  YEAR = 'Y',
}

export interface PaymentPeriod {
  amountPerPeriod: number;
  type: PaymentPeriodType;
  frequency?: number;
  times: number;
}
