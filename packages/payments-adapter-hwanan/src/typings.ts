import { OrderCommitMessage, OrderCreditCardCommitMessage, PaymentItem, PrepareOrderInput } from '@rytass/payments';
import { HwaNanPayment } from './hwanan-payment';

export enum HwaNanPaymentChannel {
  CREDIT = 1,
}

export interface HwaNanCommitMessage extends OrderCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date | null;
  platformTradeNumber: string;
  channel: HwaNanPaymentChannel;
}

export interface HwaNanCreditCardOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
}

export interface HwaNanCreditCardCommitMessage extends OrderCreditCardCommitMessage, HwaNanCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date;
}

export type HwaNanOrderInput<CM extends HwaNanCommitMessage> = CM extends HwaNanCreditCardCommitMessage ? HwaNanCreditCardOrderInput : never;

export interface HwaNanMakeOrderPayload {

}

export interface HwaNanOrderInit<OCM extends HwaNanCommitMessage> {
  id: string;
  items: PaymentItem[];
  gateway: HwaNanPayment<OCM>;
}

export interface HwaNanPrepareOrderInit<OCM extends HwaNanCommitMessage> extends HwaNanOrderInit<OCM> {
  makePayload: HwaNanMakeOrderPayload;
}
