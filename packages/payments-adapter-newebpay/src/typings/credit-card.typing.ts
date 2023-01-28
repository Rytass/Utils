import { AdditionalInfo, Channel, CreditCardAuthInfo, CreditCardECI, OrderCreditCardCommitMessage, PaymentItem, PrepareOrderInput } from '@rytass/payments';
import { AllowUILanguage, NewebPayAuthBank, NewebPayCommitMessage, NewebPayCreditCardBalanceStatus, NewebPayCreditCardSpeedCheckoutMode, NewebPayCreditCardSubChannel } from '../typings';

export enum NewebPayCreditCardInstallmentOptions {
  THREE = 3,
  SIX = 6,
  TWELVE = 12,
  EIGHTEEN = 18,
  TWENTY_FOUR = 24,
  THIRTY = 30,
}

export interface NewebPayAdditionInfoCreditCard extends CreditCardAuthInfo, AdditionalInfo<NewebPayCreditCardCommitMessage> {
  channel: Channel.CREDIT_CARD;
  authBank: NewebPayAuthBank;
  subChannel: NewebPayCreditCardSubChannel;
  speedCheckoutMode?: NewebPayCreditCardSpeedCheckoutMode;
  installments?: {
    count: number;
    firstAmount: number;
    eachAmount: number;
  };
  dcc?: {
    amount: number;
    rate: number;
    markup: number;
    currency: string;
    currencyCode: number;
  };
  bonusAmount?: number;
  closeStatus: NewebPayCreditCardBalanceStatus;
  closeBalance: number;
  refundStatus: NewebPayCreditCardBalanceStatus;
  remainingBalance: number;
}

export interface NewebPayCreditCardCommitMessage extends OrderCreditCardCommitMessage, NewebPayCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date;
}

export interface NewebPayCreditCardOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
  installments?: NewebPayCreditCardInstallmentOptions[];
  canUseBonus?: boolean;
  language?: AllowUILanguage;
}
