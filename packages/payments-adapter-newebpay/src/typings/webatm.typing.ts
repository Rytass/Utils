import { OrderWebATMCommitMessage, PaymentItem, PrepareOrderInput } from '@rytass/payments';
import { AllowUILanguage, NewebPayCommitMessage } from '../typings';

export enum NewebPayWebATMBank {
  BANK_OF_TAIWAN = 'BOT',
  HWANAN_BANK = 'HNCB',
  FIRST_BANK = 'FirstBank',
}

export interface NewebPayWebATMCommitMessage extends OrderWebATMCommitMessage, NewebPayCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date;
}

export interface NewebPayWebATMOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
  bankTypes: NewebPayWebATMBank[];
  language?: AllowUILanguage;
}
