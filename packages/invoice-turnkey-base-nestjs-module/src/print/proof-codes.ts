import { createCipheriv } from 'crypto';
import { formatPeriod, formatRocDate } from '../utils/taipei-time';

/**
 * 證明聯 QR Code 加密驗證資訊的 AES 參數：AES-128-CBC、PKCS#7 padding。
 * IV 由《加解密 API 使用說明書》Ver 1.13 的公開測試向量（金鑰 6647A889B4B5912BECB5D01065CCD670、
 * 明文 AA123456781234、密文 dSypnr83S3oOPU5HiEx49w==）推得，並以同一組向量做單元測試。
 */
export const QR_AES_IV = Buffer.from('Dt8lyToo17X/XkXaQvihuA==', 'base64');

/** 左方 QR Code 用 V6、容錯 L 的位元組容量 */
export const DEFAULT_QR_MAX_BYTES = 134;

const CONSUMER_TAX_ID = '00000000';
const UNUSED_BUSINESS_AREA = '**********';
const UTF8_ENCODING = '1';

export interface TurnkeyProofItem {
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

export interface TurnkeyProofCodeInput {
  readonly invoiceNumber: string;
  readonly issuedAt: Date;
  /** B2B 發票沒有隨機碼時填 4 個空白（規格書補充說明） */
  readonly randomNumber?: string;
  /** 未稅銷售額；B2C 無法分離稅額時為 0 */
  readonly salesAmount: number;
  readonly totalAmount: number;
  readonly buyerTaxId?: string;
  readonly sellerTaxId: string;
  /** 32 碼 HEX */
  readonly aesKey: string;
  readonly items: readonly TurnkeyProofItem[];
  /** 營業人自行使用區，10 碼 */
  readonly businessArea?: string;
  readonly leftMaxBytes?: number;
  readonly rightMaxBytes?: number;
}

export interface TurnkeyProofCodes {
  readonly barcode: string;
  readonly qrCodeLeft: string;
  readonly qrCodeRight: string;
  /** 左右 QR Code 實際記載的品目筆數 */
  readonly encodedItemCount: number;
}

const toHex8 = (value: number): string => Math.round(value).toString(16).padStart(8, '0');

const randomOrBlank = (randomNumber?: string): string => randomNumber ?? '    ';

/** 字軌號碼 10 碼加隨機碼 4 碼，AES 加密後轉 Base64（24 碼） */
export const encryptQrVerification = (invoiceNumber: string, randomNumber: string, aesKeyHex: string): string => {
  const key = Buffer.from(aesKeyHex, 'hex');

  if (key.length !== 16) throw new Error('QR Code AES key must be 32 hex characters');

  const cipher = createCipheriv('aes-128-cbc', key, QR_AES_IV);

  return Buffer.concat([cipher.update(`${invoiceNumber}${randomNumber}`, 'utf8'), cipher.final()]).toString('base64');
};

/** 一維條碼（Code 39）內容：期別 5 碼＋字軌號碼 10 碼＋隨機碼 4 碼 */
export const buildProofBarcode = (invoiceNumber: string, issuedAt: Date, randomNumber?: string): string =>
  `${formatPeriod(issuedAt)}${invoiceNumber}${randomOrBlank(randomNumber)}`;

const byteLength = (value: string): number => Buffer.byteLength(value, 'utf8');

const sanitizeName = (name: string): string => name.replace(/:/g, '：');

const itemSegment = (item: TurnkeyProofItem): string =>
  `:${sanitizeName(item.description)}:${item.quantity}:${item.unitPrice}`;

/**
 * 依《電子發票證明聯一維及二維條碼規格說明》Ver 1.9 組出左右 QR Code 字串。
 * 左方：77 碼固定欄位＋營業人自行使用區＋品目筆數＋總筆數＋編碼參數＋品目；放不下的品目接續放在右方（** 開頭）。
 */
export const buildProofCodes = (input: TurnkeyProofCodeInput): TurnkeyProofCodes => {
  const random = randomOrBlank(input.randomNumber);
  const leftMax = input.leftMaxBytes ?? DEFAULT_QR_MAX_BYTES;
  const rightMax = input.rightMaxBytes ?? DEFAULT_QR_MAX_BYTES;

  const fixed = [
    input.invoiceNumber,
    formatRocDate(input.issuedAt),
    random,
    toHex8(input.salesAmount),
    toHex8(input.totalAmount),
    input.buyerTaxId && input.buyerTaxId.length === 8 ? input.buyerTaxId : CONSUMER_TAX_ID,
    input.sellerTaxId,
    encryptQrVerification(input.invoiceNumber, random, input.aesKey),
  ].join('');

  const segments = input.items.map(itemSegment);

  // 先決定左右各放幾筆，再寫入筆數欄位（筆數位數會影響長度，所以以總筆數位數估算）
  const countWidth = String(input.items.length).length;
  const leftHeaderLength =
    byteLength(fixed) + byteLength(`:${input.businessArea ?? UNUSED_BUSINESS_AREA}`) + 2 * (1 + countWidth) + 2;

  const takeWhileFits = (
    list: readonly string[],
    budget: number,
  ): { readonly taken: readonly string[]; readonly rest: readonly string[] } => {
    const index = list.reduce<{ readonly used: number; readonly count: number; readonly stopped: boolean }>(
      (state, segment) => {
        if (state.stopped) return state;

        const size = byteLength(segment);

        return state.used + size <= budget
          ? { used: state.used + size, count: state.count + 1, stopped: false }
          : { ...state, stopped: true };
      },
      { used: 0, count: 0, stopped: false },
    ).count;

    return { taken: list.slice(0, index), rest: list.slice(index) };
  };

  const left = takeWhileFits(segments, Math.max(0, leftMax - leftHeaderLength));
  const right = takeWhileFits(left.rest, Math.max(0, rightMax - 2));
  const encodedItemCount = left.taken.length + right.taken.length;

  const qrCodeLeft = [
    fixed,
    `:${input.businessArea ?? UNUSED_BUSINESS_AREA}`,
    `:${encodedItemCount}`,
    `:${input.items.length}`,
    `:${UTF8_ENCODING}`,
    ...left.taken,
  ].join('');

  // 右方接續左方的「中文編碼後資訊」，品目以冒號分隔，去掉第一筆前導冒號
  const qrCodeRight = `**${right.taken.join('').replace(/^:/, '')}`;

  return {
    barcode: buildProofBarcode(input.invoiceNumber, input.issuedAt, input.randomNumber),
    qrCodeLeft,
    qrCodeRight,
    encodedItemCount,
  };
};
