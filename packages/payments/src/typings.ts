import { EventEmitter } from 'events';

export interface PaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface PrepareOrderInput {
  items: PaymentItem[];
}

export interface OrderCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date;
}

export interface OrderCommitAdditionalInformation {
  creditCardAuthInfo?: CreditCardAuthInfo;
}

export interface Order<OCM extends OrderCommitMessage> extends PrepareOrderInput {
  // Order State
  state: OrderState;

  // Order created at (send to gateway time)
  createdAt: Date | null;

  // Order committed at
  committedAt: Date | null;

  // Credit card auth info
  creditCardAuthInfo?: CreditCardAuthInfo;

  id: string;
  items: PaymentItem[];
  commitable: boolean;
  commit<T extends OCM>(message: T): void;
}

export interface PaymentGateway<
  OInput extends PrepareOrderInput,
  OCM extends OrderCommitMessage,
  O extends Order<OCM>,
> {
  emitter: EventEmitter;

  prepare<T extends OInput, P extends O>(orderInput: T): P;

  query<T extends O>(id: string): Promise<T>;
}

export enum Channel {
  CREDIT_CARD = 'CREDIT_CARD',
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
