import { TurnkeyDeliveryMode, TurnkeyTaxType, TurnkeyCustomsClearance } from '../src/typings/turnkey-enums';
import { buildProofCodes } from '../src/print/proof-codes';
import type { TurnkeyAllowanceProof, TurnkeyInvoiceProof, TurnkeyProofLine } from '../src/print/turnkey-print.types';

/** 測試用 AES 金鑰（《加解密 API 使用說明書》公開測試向量） */
export const TEST_AES_KEY = '6647A889B4B5912BECB5D01065CCD670';

const ISSUED_AT = new Date('2026-10-21T02:30:00Z');

const seller = { taxId: '12345675', name: '測試營業人', address: '台北市信義區測試路 1 號' };

const line = (sequenceNumber: number, description: string, quantity: number, unitPrice: number): TurnkeyProofLine => ({
  sequenceNumber,
  description,
  quantity,
  unit: null,
  unitPrice,
  amount: quantity * unitPrice,
  taxType: TurnkeyTaxType.TAXABLE,
  remark: null,
});

/** 規格測試資料：定期票：月票 2×640、Coffee 1×55，總計 1335 */
export const buildInvoiceProof = (overrides: Partial<TurnkeyInvoiceProof> = {}): TurnkeyInvoiceProof => {
  const items = [line(1, '定期票：月票', 2, 640), line(2, 'Coffee', 1, 55)];
  const invoiceNumber = 'ZZ00000003';
  const randomNumber = '9691';
  const barcodeAndCodes = buildProofCodes({
    invoiceNumber,
    issuedAt: ISSUED_AT,
    randomNumber,
    salesAmount: 0,
    totalAmount: 1335,
    sellerTaxId: seller.taxId,
    aesKey: TEST_AES_KEY,
    items: items.map(item => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice })),
  });

  return {
    documentType: 'INVOICE',
    invoiceNumber,
    issuedAt: ISSUED_AT,
    periodLabel: '115年09-10月',
    randomNumber,
    seller,
    buyer: { taxId: null, name: '消費者', address: null },
    deliveryMode: TurnkeyDeliveryMode.STORAGE,
    taxType: TurnkeyTaxType.TAXABLE,
    salesAmount: 1271,
    taxFreeSalesAmount: 0,
    zeroRatedSalesAmount: 0,
    taxAmount: 64,
    totalAmount: 1335,
    zeroRated: null,
    mainRemark: null,
    items,
    barcode: barcodeAndCodes.barcode,
    qrCodeLeft: barcodeAndCodes.qrCodeLeft,
    qrCodeRight: barcodeAndCodes.qrCodeRight,
    printCount: 1,
    reprint: false,
    printedAt: new Date('2026-10-21T03:00:00Z'),
    ...overrides,
  };
};

/** 補印的 B2C 發票 */
export const buildReprintProof = (): TurnkeyInvoiceProof => buildInvoiceProof({ printCount: 2, reprint: true });

/** B2B 零稅率、交換發票、多品項（觸發 A4 分頁）、無隨機碼 */
export const buildB2bProof = (itemCount = 70): TurnkeyInvoiceProof => {
  const items = Array.from({ length: itemCount }, (_, index) =>
    line(index + 1, `品項 ${index + 1} 測試商品名稱較長需要換行處理 Item ${index + 1}`, index + 1, 100 + index),
  );

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const invoiceNumber = 'ZZ00000004';
  const barcodeAndCodes = buildProofCodes({
    invoiceNumber,
    issuedAt: ISSUED_AT,
    salesAmount: totalAmount,
    totalAmount,
    buyerTaxId: '87654321',
    sellerTaxId: seller.taxId,
    aesKey: TEST_AES_KEY,
    items: items.map(item => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice })),
  });

  return {
    documentType: 'INVOICE',
    invoiceNumber,
    issuedAt: ISSUED_AT,
    periodLabel: '115年09-10月',
    randomNumber: null,
    seller,
    buyer: { taxId: '87654321', name: '買方股份有限公司', address: '新北市板橋區測試街 99 號' },
    deliveryMode: TurnkeyDeliveryMode.EXCHANGE,
    taxType: TurnkeyTaxType.ZERO_RATED,
    salesAmount: 0,
    taxFreeSalesAmount: 0,
    zeroRatedSalesAmount: totalAmount,
    taxAmount: 0,
    totalAmount,
    zeroRated: { reasonCode: '2', customsClearance: TurnkeyCustomsClearance.VIA_CUSTOMS },
    mainRemark: '測試備註',
    items,
    barcode: barcodeAndCodes.barcode,
    qrCodeLeft: barcodeAndCodes.qrCodeLeft,
    qrCodeRight: barcodeAndCodes.qrCodeRight,
    printCount: 1,
    reprint: false,
    printedAt: new Date('2026-10-21T03:00:00Z'),
  };
};

export const buildAllowanceProof = (overrides: Partial<TurnkeyAllowanceProof> = {}): TurnkeyAllowanceProof => ({
  documentType: 'ALLOWANCE',
  allowanceNumber: 'AL00000001',
  allowanceDate: ISSUED_AT,
  originalInvoiceNumber: 'ZZ00000003',
  originalInvoiceIssuedAt: ISSUED_AT,
  seller,
  buyer: { taxId: '87654321', name: '買方股份有限公司', address: null },
  deliveryMode: TurnkeyDeliveryMode.STORAGE,
  totalAmount: 100,
  taxAmount: 5,
  items: [
    {
      sequenceNumber: 1,
      originalSequenceNumber: 2,
      description: 'Coffee',
      quantity: 1,
      unitPrice: 55,
      amount: 55,
      tax: 3,
      taxType: TurnkeyTaxType.TAXABLE,
    },
    {
      sequenceNumber: 2,
      originalSequenceNumber: null,
      description: '其他折讓',
      quantity: 1,
      unitPrice: 45,
      amount: 45,
      tax: 2,
      taxType: TurnkeyTaxType.TAXABLE,
    },
  ],
  printCount: 1,
  reprint: false,
  printedAt: ISSUED_AT,
  ...overrides,
});
