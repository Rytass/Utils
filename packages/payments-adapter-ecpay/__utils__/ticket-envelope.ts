import { createCipheriv, createDecipheriv } from 'crypto';
import { computeTicketCheckMacValue as computeMac } from '../src/ecpay-utils';

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

// 對稱於 production 的 decryptToPlaintext：解密並還原成「加密前的原始明文字串」(尚未 JSON.parse)，
// 供測試以與 ECPay server 相同的字串基準計算 CheckMacValue。
export function decryptTicketDataToPlaintext(encryptedData: string, creds: TicketCreds = DEFAULT_TICKET_CREDS): string {
  const decipher = createDecipheriv('aes-128-cbc', creds.hashKey, creds.hashIv);

  return decodeURIComponent([decipher.update(encryptedData, 'base64', 'utf8'), decipher.final('utf8')].join(''));
}

// 委派 ecpay-utils 的唯一實作，僅補上測試預設憑證，確保測試與 production 用同一套 MAC 演算法。
export function computeTicketCheckMacValue(plaintext: string, creds: TicketCreds = DEFAULT_TICKET_CREDS): string {
  return computeMac(plaintext, creds);
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
  // 與 production 一致：同一份明文字串既拿去加密成 Data，也拿去計算 CheckMacValue
  const plaintext = JSON.stringify(decryptedData);
  const encrypted = encryptTicketData(decryptedData, creds);

  return {
    PlatformID: '',
    MerchantID: options?.merchantId ?? '2000132',
    RpHeader: { Timestamp: Math.round(Date.now() / 1000) },
    TransCode: options?.transCode ?? 1,
    TransMsg: options?.transMsg ?? '',
    Data: encrypted,
    CheckMacValue: computeTicketCheckMacValue(plaintext, creds),
  };
}
