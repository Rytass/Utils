import { Channel, CVS, PaymentPeriodType } from '@rytass/payments';

export const ECPayPaymentPeriodType: Record<PaymentPeriodType, string> = {
  [PaymentPeriodType.DAY]: 'D',
  [PaymentPeriodType.MONTH]: 'M',
  [PaymentPeriodType.YEAR]: 'Y',
};

export const ECPayChannel: Record<Extract<Channel, Channel.CREDIT_CARD | Channel.WEB_ATM | Channel.VIRTUAL_ACCOUNT | Channel.CVS_KIOSK | Channel.CVS_BARCODE | Channel.APPLE_PAY>, string> = {
  [Channel.CREDIT_CARD]: 'Credit',
  [Channel.WEB_ATM]: 'WebATM',
  [Channel.VIRTUAL_ACCOUNT]: 'ATM',
  [Channel.CVS_KIOSK]: 'CVS',
  [Channel.CVS_BARCODE]: 'BARCODE',
  [Channel.APPLE_PAY]: 'ApplePay',
};

export const NUMERIC_CALLBACK_KEYS = [
  'Count',
  'RtnCode',
  'TradeAmt',
  'SimulatePaid',
  'gwsr',
  'amount',
  'eci',
];

export const ECPayCVS: Record<string, CVS> = {
  family: CVS.FAMILY_MART,
  hilife: CVS.HILIFE,
  okmart: CVS.OK_MART,
  ibon: CVS.SEVEN_ELEVEN,
};
