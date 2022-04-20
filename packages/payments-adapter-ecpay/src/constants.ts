import { Channel } from '@rytass/payments';

export const ECPayChannel: Record<Channel, string> = {
  [Channel.CREDIT_CARD]: 'Credit',
  [Channel.WEB_ATM]: 'WebATM',
  [Channel.VIRTUAL_ACCOUNT]: 'ATM',
  [Channel.CVS_KIOSK]: 'CVS',
  [Channel.CVS_BARCODE]: 'BARCODE',
};

export const NUMERIC_CALLBACK_KEYS = [
  'RtnCode',
  'TradeAmt',
  'SimulatePaid',
  'gwsr',
  'amount',
  'eci',
];
