import { OrderVirtualAccountCommitMessage, PaymentItem, PrepareOrderInput } from '@rytass/payments';
import { AllowUILanguage, NewebPayCommitMessage, NewebPaymentChannel } from '../typings';

export enum NewebPayVirtualAccountBank {
  BANK_OF_TAIWAN = 'BOT',
  HWANAN_BANK = 'HNCB',
  FIRST_BANK = 'FirstBank',
}

export interface NewebPayVirtualAccountCommitMessage extends OrderVirtualAccountCommitMessage, NewebPayCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date;
}

export interface NewebPayVirtualAccountOrderInput extends PrepareOrderInput {
  channel: NewebPaymentChannel.VACC;
  id?: string;
  items: PaymentItem[];
  bankTypes: NewebPayVirtualAccountBank[];
  language?: AllowUILanguage;
}
