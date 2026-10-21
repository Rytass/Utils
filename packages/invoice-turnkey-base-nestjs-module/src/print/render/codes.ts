import type { BitRows } from './layout';
import { loadOptional, unwrapDefault } from './optional-modules';

/** 規格要求左右 QR Code 至少 V6（41×41）、容錯等級 L */
const MIN_QR_VERSION = 6;

export interface InvoiceCodeGraphics {
  readonly qrLeft: BitRows;
  readonly qrRight: BitRows;
  /** 條碼的 bar／space 序列，每一格為一個窄條單位；true 代表黑條 */
  readonly barcodeBars: readonly boolean[];
}

const toRows = (modules: { readonly size: number; get(row: number, col: number): unknown }): BitRows =>
  Array.from({ length: modules.size }, (_, row) =>
    Array.from({ length: modules.size }, (_unused, col) => Boolean(modules.get(row, col))),
  );

/**
 * 左右 QR Code 使用同一個版本，確保兩者尺寸一致；版本取 max(V6, 左右各自需要的最小版本)。
 */
export const buildQrMatrices = async (
  left: string,
  right: string,
): Promise<{ readonly left: BitRows; readonly right: BitRows }> => {
  const QRCode = unwrapDefault(await loadOptional('qrcode', 'QR Code', () => import('qrcode')));
  const minimalVersion = (text: string): number => QRCode.create(text, { errorCorrectionLevel: 'L' }).version;
  const version = Math.max(MIN_QR_VERSION, minimalVersion(left), minimalVersion(right));
  const create = (text: string): ReturnType<typeof QRCode.create>['modules'] =>
    QRCode.create(text, { errorCorrectionLevel: 'L', version }).modules;

  return { left: toRows(create(left)), right: toRows(create(right)) };
};

/**
 * Code 39 條碼：沿用 bwip-js 的 bar／space 序列，寬條由 3 改為 2（Code 39 允許 2:1 至 3:1），
 * 讓 19 碼條碼的寬度落在 57 mm 熱感紙內。
 */
export const buildBarcodeBars = async (text: string): Promise<readonly boolean[]> => {
  const bwipjs = unwrapDefault(await loadOptional('bwip-js', 'Code 39 條碼', () => import('bwip-js')));
  const [symbol] = bwipjs.raw({ bcid: 'code39', text, includetext: false });

  return symbol.sbs.flatMap((units, index) => Array.from({ length: units === 3 ? 2 : 1 }, () => index % 2 === 0));
};

export const buildInvoiceCodeGraphics = async (
  qrLeft: string,
  qrRight: string,
  barcode: string,
): Promise<InvoiceCodeGraphics> => {
  const [matrices, barcodeBars] = await Promise.all([buildQrMatrices(qrLeft, qrRight), buildBarcodeBars(barcode)]);

  return { qrLeft: matrices.left, qrRight: matrices.right, barcodeBars };
};
