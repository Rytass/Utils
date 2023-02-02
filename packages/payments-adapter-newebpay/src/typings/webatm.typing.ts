import { AdditionalInfo, Channel, OrderWebATMCommitMessage, PaymentItem, PrepareOrderInput } from '@rytass/payments';
import { AllowUILanguage, NewebPayCommitMessage, NewebPaymentChannel } from '../typings';

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
  channel: NewebPaymentChannel.WEBATM;
  id?: string;
  items: PaymentItem[];
  bankTypes: NewebPayWebATMBank[];
  language?: AllowUILanguage;
}
