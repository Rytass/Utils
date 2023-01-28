import { OrderLinePayCommitMessage, PaymentItem, PrepareOrderInput } from '@rytass/payments';
import { AllowUILanguage, NewebPayCommitMessage } from '../typings';

export interface NewebPayLinePayCommitMessage extends OrderLinePayCommitMessage, NewebPayCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date;
}

export interface NewebPayLinePayOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
  imageUrl?: string;
  language?: AllowUILanguage;
}
