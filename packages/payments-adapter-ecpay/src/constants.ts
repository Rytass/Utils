import { Channel } from '@rytass/payments';

export const ECPayChannel: Record<Channel, string> = {
  [Channel.CREDIT_CARD]: 'Credit',
};

export const NUMERIC_CALLBACK_KEYS = [
  'RtnCode',
  'TradeAmt',
  'SimulatePaid',
  'gwsr',
  'amount',
  'eci',
];
