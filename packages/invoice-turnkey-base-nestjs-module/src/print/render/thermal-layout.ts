import type { TurnkeyAllowanceProof, TurnkeyInvoiceProof } from '../turnkey-print.types';
import { formatAmount, formatDate, formatDateTime, formatInvoiceNumber } from './format';
import type { InvoiceCodeGraphics } from './codes';
import { type BitRows, LayoutCursor, type Page, type TextMetrics } from './layout';

/** 熱感紙左右留白 */
const MARGIN_MM = 2.5;

/** QR Code 每個模組 0.375 mm，V6 編碼區約 15.4 mm，符合每邊至少 1.5 cm */
export const QR_MODULE_MM = 0.375;
/** QR Code 四周留白至少 0.2 cm */
export const QR_QUIET_MM = 2.5;
const QR_GAP_MM = 3;

/** Code 39 窄條 0.1875 mm（PNG 為 3 px），19 碼條碼約 51 mm */
export const BARCODE_NARROW_MM = 0.1875;
const BARCODE_HEIGHT_MM = 10;

const createCursor = (widthMm: number, metrics: TextMetrics): LayoutCursor =>
  new LayoutCursor({
    widthMm,
    pageHeightMm: Number.POSITIVE_INFINITY,
    marginMm: MARGIN_MM,
    topMarginMm: MARGIN_MM,
    bottomMarginMm: MARGIN_MM,
    metrics,
  });

const toPage = (cursor: LayoutCursor): Page => ({
  widthMm: cursor.widthMm,
  heightMm: cursor.y + cursor.bottomMarginMm,
  ops: cursor.pages()[0],
});

const qrSideMm = (rows: BitRows): number => rows.length * QR_MODULE_MM + 2 * QR_QUIET_MM;

/** 左右並列、上緣對齊、大小一致的兩個 QR Code */
const placeQrPair = (cursor: LayoutCursor, codes: InvoiceCodeGraphics): void => {
  const side = qrSideMm(codes.qrLeft);
  const x = (cursor.widthMm - (2 * side + QR_GAP_MM)) / 2;
  const top = cursor.y + QR_QUIET_MM;

  cursor.bitmap(x + QR_QUIET_MM, top, QR_MODULE_MM, QR_MODULE_MM, codes.qrLeft);
  cursor.bitmap(x + side + QR_GAP_MM + QR_QUIET_MM, top, QR_MODULE_MM, QR_MODULE_MM, codes.qrRight);
  cursor.advance(side + 1);
};

const placeBarcode = (cursor: LayoutCursor, bars: readonly boolean[], humanText: string): void => {
  const x = (cursor.widthMm - bars.length * BARCODE_NARROW_MM) / 2;

  cursor.bitmap(x, cursor.y, BARCODE_NARROW_MM, BARCODE_HEIGHT_MM, [bars]);
  cursor.advance(BARCODE_HEIGHT_MM + 0.8);
  cursor.text(humanText.trimEnd(), 7);
};

/** 左欄靠左換行、右欄靠右對齊於首行，推進游標一行的高度 */
const pairRow = (cursor: LayoutCursor, left: string, right: string, sizePt: number): void => {
  const rightWidth = cursor.metrics.widthMm(right, sizePt) + 1;
  const leftWidth = cursor.contentWidth - rightWidth;
  const height = cursor.paragraph(left, {
    x: cursor.marginMm,
    y: cursor.y,
    width: leftWidth,
    sizePt,
    align: 'left',
  });

  cursor.paragraph(right, {
    x: cursor.marginMm + leftWidth,
    y: cursor.y,
    width: rightWidth,
    sizePt,
    align: 'right',
  });

  cursor.advance(height);
};

const placeRule = (cursor: LayoutCursor): void => {
  cursor.advance(1);
  cursor.rect(cursor.marginMm, cursor.y, cursor.contentWidth, 0.3, true);
  cursor.advance(1.5);
};

/** 熱感紙證明聯：依規格的欄位順序，條碼與左右 QR Code 放在最下方 */
export const layoutThermalInvoice = (
  proof: TurnkeyInvoiceProof,
  codes: InvoiceCodeGraphics,
  paperWidthMm: number,
  metrics: TextMetrics,
): Page => {
  const cursor = createCursor(paperWidthMm, metrics);

  cursor.text(proof.seller.name, 11);
  cursor.text('電子發票證明聯', 14);

  if (proof.reprint) cursor.text('補印', 12);

  cursor.text(proof.periodLabel, 10);
  cursor.text(formatInvoiceNumber(proof.invoiceNumber), 16);
  cursor.text(formatDateTime(proof.issuedAt), 9);
  cursor.text(`隨機碼 ${proof.randomNumber ?? '無'}`, 9);
  cursor.text(`總計 ${formatAmount(proof.totalAmount)}`, 12);
  cursor.text(`賣方統編 ${proof.seller.taxId ?? ''}`, 9);

  if (proof.buyer.taxId) cursor.text(`買方統編 ${proof.buyer.taxId}`, 9);

  cursor.advance(2);
  placeBarcode(cursor, codes.barcodeBars, proof.barcode);
  cursor.advance(2);
  placeQrPair(cursor, codes);

  return toPage(cursor);
};

/** 熱感紙折讓證明單：沒有條碼與 QR Code，留買受人簽收欄 */
export const layoutThermalAllowance = (
  proof: TurnkeyAllowanceProof,
  paperWidthMm: number,
  metrics: TextMetrics,
): Page => {
  const cursor = createCursor(paperWidthMm, metrics);

  cursor.text(proof.seller.name, 11);
  cursor.text('折讓證明單', 14);

  if (proof.reprint) cursor.text('補印', 12);

  cursor.text(`折讓單號 ${proof.allowanceNumber}`, 10);
  cursor.text(`折讓日期 ${formatDate(proof.allowanceDate)}`, 9);
  cursor.text(`原發票 ${formatInvoiceNumber(proof.originalInvoiceNumber)}`, 9);
  cursor.text(`原發票日期 ${formatDate(proof.originalInvoiceIssuedAt)}`, 9);
  cursor.text(`賣方統編 ${proof.seller.taxId ?? ''}`, 9);
  cursor.text(`買方統編 ${proof.buyer.taxId ?? '消費者'}`, 9);

  placeRule(cursor);

  proof.items.forEach(item => {
    pairRow(cursor, item.description, formatAmount(item.amount), 9);
    cursor.text(`${item.quantity} x ${formatAmount(item.unitPrice)}`, 8, 'left');
  });

  placeRule(cursor);

  pairRow(cursor, '未稅金額', formatAmount(proof.totalAmount), 10);
  pairRow(cursor, '稅額', formatAmount(proof.taxAmount), 10);
  pairRow(cursor, '折讓合計', formatAmount(proof.totalAmount + proof.taxAmount), 12);

  cursor.advance(3);
  cursor.text('買受人簽收', 10, 'left');
  cursor.rect(cursor.marginMm, cursor.y, cursor.contentWidth, 14, false);
  cursor.advance(16);

  return toPage(cursor);
};
