import { EventEmitter } from 'events';

export interface PaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface PrepareOrderInput {
  items: PaymentItem[];
}

export interface Order extends PrepareOrderInput {
  id: string;
  items: PaymentItem[];
}

export interface PaymentGateway<
  OInput extends PrepareOrderInput,
  O extends Order,
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
  process_date: string;
  auth_code: string; // Credit Card Auth Code (6 digits)
  amount: number;
  eci: CreditCardECI;
  card4no: string;
  card6no: string;
}

export enum OrderState {
  INITED = 'INITED',
  PRE_COMMIT = 'PRE_COMMIT', // Created
  COMMITTED = 'COMMITTED', // Fulfilled
}

export enum PaymentEvents {
  ORDER_PRE_COMMIT = 'PRE_COMMIT',
  ORDER_COMMITTED = 'COMMITTED',
}
