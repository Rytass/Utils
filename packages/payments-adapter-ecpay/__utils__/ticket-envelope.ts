import { createCipheriv } from 'crypto';
import { ecpaySha256, ecpayUrlEncode } from '../src/ecpay-utils';

export interface TicketCreds {
  hashKey: string;
  hashIv: string;
}

export const DEFAULT_TICKET_CREDS: TicketCreds = {
  hashKey: '5294y06JbISpM5x9',
  hashIv: 'v77hoKGq4kWxNNIS',
};

export function encryptTicketData<T>(data: T, creds: TicketCreds = DEFAULT_TICKET_CREDS): string {
  const encoded = encodeURIComponent(JSON.stringify(data));
  const cipher = createCipheriv('aes-128-cbc', creds.hashKey, creds.hashIv);

  cipher.setAutoPadding(true);

  return [cipher.update(encoded, 'utf8', 'base64'), cipher.final('base64')].join('');
}

export function computeTicketCheckMacValue(encryptedData: string, creds: TicketCreds = DEFAULT_TICKET_CREDS): string {
  return ecpaySha256(ecpayUrlEncode(`HashKey=${creds.hashKey}&Data=${encryptedData}&HashIV=${creds.hashIv}`));
}

export function buildTicketResponseEnvelope<T>(
  decryptedData: T,
  options?: {
    merchantId?: string;
    transCode?: number;
    transMsg?: string;
    creds?: TicketCreds;
  },
): {
  PlatformID: string;
  MerchantID: string;
  RpHeader: { Timestamp: number };
  TransCode: number;
  TransMsg: string;
  Data: string;
  CheckMacValue: string;
} {
  const creds = options?.creds ?? DEFAULT_TICKET_CREDS;
  const encrypted = encryptTicketData(decryptedData, creds);

  return {
    PlatformID: '',
    MerchantID: options?.merchantId ?? '2000132',
    RpHeader: { Timestamp: Math.round(Date.now() / 1000) },
    TransCode: options?.transCode ?? 1,
    TransMsg: options?.transMsg ?? '',
    Data: encrypted,
    CheckMacValue: computeTicketCheckMacValue(encrypted, creds),
  };
}
