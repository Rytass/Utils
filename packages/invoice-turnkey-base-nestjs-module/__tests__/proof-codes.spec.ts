/**
 * @jest-environment node
 */

import { createDecipheriv } from 'crypto';
import { buildProofBarcode, buildProofCodes, encryptQrVerification, QR_AES_IV } from '../src';

// 《加解密 API 使用說明書》Ver 1.13 公開的測試向量
const TEST_AES_KEY = '6647A889B4B5912BECB5D01065CCD670';

describe('encryptQrVerification', () => {
  it('matches the MOF published test vector', () => {
    expect(encryptQrVerification('AA12345678', '1234', TEST_AES_KEY)).toBe('dSypnr83S3oOPU5HiEx49w==');
  });

  it('produces 24 characters that decrypt back to number and random code', () => {
    const encrypted = encryptQrVerification('ZZ00000600', '0042', TEST_AES_KEY);
    const decipher = createDecipheriv('aes-128-cbc', Buffer.from(TEST_AES_KEY, 'hex'), QR_AES_IV);

    expect(encrypted).toHaveLength(24);
    expect(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString()).toBe(
      'ZZ000006000042',
    );
  });

  it('rejects malformed keys', () => {
    expect(() => encryptQrVerification('ZZ00000600', '0042', 'ABC')).toThrow('32 hex');
  });
});

describe('buildProofBarcode', () => {
  it('follows period + number + random code (19 characters)', () => {
    // 規格書範例：*10404UZ176908720122*
    expect(buildProofBarcode('UZ17690872', new Date('2015-04-10T04:00:00Z'), '0122')).toBe('10404UZ176908720122');
  });

  it('uses four spaces when a B2B invoice has no random code', () => {
    expect(buildProofBarcode('ZZ00000600', new Date('2026-10-21T02:00:00Z'))).toBe('11510ZZ00000600    ');
  });
});

describe('buildProofCodes', () => {
  const base = {
    invoiceNumber: 'ZZ00000600',
    issuedAt: new Date('2026-10-21T02:30:00Z'),
    randomNumber: '0042',
    salesAmount: 1219,
    totalAmount: 1280,
    buyerTaxId: '87654322',
    sellerTaxId: '12345675',
    aesKey: TEST_AES_KEY,
  };

  it('starts the left QR with the 77-character fixed block', () => {
    const codes = buildProofCodes({ ...base, items: [{ description: '定期票', quantity: 1, unitPrice: 1280 }] });
    const fixed = codes.qrCodeLeft.slice(0, 77);

    expect(fixed.slice(0, 10)).toBe('ZZ00000600');
    expect(fixed.slice(10, 17)).toBe('1151021');
    expect(fixed.slice(17, 21)).toBe('0042');
    expect(fixed.slice(21, 29)).toBe('000004c3');
    expect(fixed.slice(29, 37)).toBe('00000500');
    expect(fixed.slice(37, 45)).toBe('87654322');
    expect(fixed.slice(45, 53)).toBe('12345675');
    expect(fixed.slice(53)).toBe(encryptQrVerification('ZZ00000600', '0042', TEST_AES_KEY));
    expect(codes.qrCodeLeft.slice(77)).toBe(':**********:1:1:1:定期票:1:1280');
    expect(codes.qrCodeRight).toBe('**');
    expect(codes.barcode).toBe('11510ZZ000006000042');
  });

  it('uses 00000000 for consumers and moves overflow items to the right QR', () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      description: `商品${index + 1}`,
      quantity: 1,
      unitPrice: 10,
    }));

    const codes = buildProofCodes({ ...base, buyerTaxId: undefined, items });

    expect(codes.qrCodeLeft.slice(37, 45)).toBe('00000000');
    expect(Buffer.byteLength(codes.qrCodeLeft)).toBeLessThanOrEqual(134);
    expect(codes.qrCodeRight.startsWith('**')).toBe(true);
    expect(codes.encodedItemCount).toBe(6);

    const leftItems = codes.qrCodeLeft.split(':').slice(5);
    const rightItems = codes.qrCodeRight.slice(2).split(':');

    expect([...leftItems, ...rightItems].filter((_, index) => index % 3 === 0)).toEqual(
      items.map(item => item.description),
    );
  });

  it('replaces colons in item names so fields stay aligned', () => {
    const codes = buildProofCodes({ ...base, items: [{ description: 'A:B', quantity: 2, unitPrice: 5 }] });

    expect(codes.qrCodeLeft.endsWith(':A：B:2:5')).toBe(true);
  });
});
