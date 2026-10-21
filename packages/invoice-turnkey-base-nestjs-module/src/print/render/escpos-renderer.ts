import type { TurnkeyProof } from '../turnkey-print.types';
import { type InvoiceCodeGraphics, buildInvoiceCodeGraphics } from './codes';
import { formatAmount, formatDate, formatDateTime, formatInvoiceNumber } from './format';
import { loadOptional, unwrapDefault } from './optional-modules';
import { Raster } from './raster';

const ESC = 0x1b;
const GS = 0x1d;
const FS = 0x1c;

/** 熱感紙可印寬度（點）：57／58 mm 機型為 384 點，80 mm 為 576 點 */
const dotsFor = (paperWidthMm: number): number => (paperWidthMm >= 70 ? 576 : 384);
const columnsFor = (dots: number): number => (dots >= 576 ? 48 : 32);
const CODE_LINE_DOTS = 60;
const QUIET_DOTS = 16;

const command = (...bytes: readonly number[]): Buffer => Buffer.from(bytes);

const ALIGN: Readonly<Record<'left' | 'center' | 'right', number>> = { left: 0, center: 1, right: 2 };

/** 半形 1 欄、全形（CJK）2 欄 */
const columnWidth = (text: string): number =>
  Array.from(text).reduce((sum, char) => sum + (char.charCodeAt(0) > 0x7f ? 2 : 1), 0);

const wrapColumns = (text: string, columns: number): readonly string[] => {
  const split = Array.from(text).reduce<{ readonly lines: readonly string[]; readonly current: string }>(
    (state, char) => {
      const next = `${state.current}${char}`;

      return state.current === '' || columnWidth(next) <= columns
        ? { lines: state.lines, current: next }
        : { lines: [...state.lines, state.current], current: char };
    },
    { lines: [], current: '' },
  );

  return [...split.lines, split.current];
};

/** 點陣圖（GS v 0）：每列以 8 點為一個位元組，最高位為最左邊的點 */
const rasterCommand = (raster: Raster): Buffer => {
  const bytesPerRow = Math.ceil(raster.width / 8);
  const data = Buffer.alloc(bytesPerRow * raster.height);

  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      if (raster.isInk(x, y)) data[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  return Buffer.concat([
    command(
      GS,
      0x76,
      0x30,
      0x00,
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      raster.height & 0xff,
      (raster.height >> 8) & 0xff,
    ),
    data,
  ]);
};

const placeBits = (raster: Raster, rows: InvoiceCodeGraphics['qrLeft'], x: number, y: number, cell: number): void =>
  rows.forEach((row, rowIndex) =>
    row.forEach((on, columnIndex) => {
      if (on) {
        raster.fillRect(
          x + columnIndex * cell,
          y + rowIndex * cell,
          x + (columnIndex + 1) * cell,
          y + (rowIndex + 1) * cell,
        );
      }
    }),
  );

/** 左右兩個 QR Code 合成一張點陣圖（熱感機的 QR 指令一次只能印一個，無法左右並列） */
const qrPairRaster = (codes: InvoiceCodeGraphics, dots: number): Raster => {
  const cell = dots >= 576 ? 4 : 3;
  const side = codes.qrLeft.length * cell + 2 * QUIET_DOTS;
  const gap = 24;
  const x = Math.round((dots - (2 * side + gap)) / 2);
  const raster = new Raster(dots, side);

  placeBits(raster, codes.qrLeft, x + QUIET_DOTS, QUIET_DOTS, cell);
  placeBits(raster, codes.qrRight, x + side + gap + QUIET_DOTS, QUIET_DOTS, cell);

  return raster;
};

/** Code 39 以 1 點為窄條輸出（19 碼約 273 點，符合 384 點的熱感頭寬度） */
const barcodeRaster = (bars: readonly boolean[], dots: number): Raster => {
  const x = Math.round((dots - bars.length) / 2);
  const raster = new Raster(dots, CODE_LINE_DOTS);

  bars.forEach((on, index) => {
    if (on) raster.fillRect(x + index, 0, x + index + 1, CODE_LINE_DOTS);
  });

  return raster;
};

const textLine = (
  iconv: { encode(text: string, encoding: string): Buffer },
  text: string,
  options: {
    readonly align: 'left' | 'center' | 'right';
    readonly doubleSize?: boolean;
    readonly columns: number;
  },
): Buffer => {
  const size = options.doubleSize ? command(GS, 0x21, 0x11) : command(GS, 0x21, 0x00);
  const lines = wrapColumns(text, options.doubleSize ? Math.floor(options.columns / 2) : options.columns);

  return Buffer.concat([
    command(ESC, 0x61, ALIGN[options.align]),
    size,
    ...lines.map(line => iconv.encode(`${line}\n`, 'big5')),
  ]);
};

/**
 * 熱感出單機指令（ESC/POS）。中文以 Big5 編碼（台灣熱感機常用）輸出，
 * 條碼與 QR Code 以點陣圖（GS v 0）輸出，不依賴機型支援的條碼或 QR 指令。
 */
export const renderEscPos = async (proof: TurnkeyProof, paperWidthMm: number): Promise<Buffer> => {
  const iconv = unwrapDefault(await loadOptional('iconv-lite', 'ESC/POS 中文編碼（Big5）', () => import('iconv-lite')));
  const dots = dotsFor(paperWidthMm);
  const columns = columnsFor(dots);
  const line = (text: string, align: 'left' | 'center' | 'right' = 'center', doubleSize = false): Buffer =>
    textLine(iconv, text, { align, columns, doubleSize });

  const header = [command(ESC, 0x40), command(FS, 0x26)];

  if (proof.documentType === 'ALLOWANCE') {
    const body = [
      line(proof.seller.name),
      line('折讓證明單', 'center', true),
      ...(proof.reprint ? [line('補印', 'center', true)] : []),
      line(`折讓單號 ${proof.allowanceNumber}`, 'left'),
      line(`折讓日期 ${formatDate(proof.allowanceDate)}`, 'left'),
      line(`原發票 ${formatInvoiceNumber(proof.originalInvoiceNumber)}`, 'left'),
      line(`買方統編 ${proof.buyer.taxId ?? '消費者'}`, 'left'),
      line('-'.repeat(columns), 'left'),
      ...proof.items.flatMap(item => [
        line(item.description, 'left'),
        line(`${item.quantity} x ${formatAmount(item.unitPrice)}  ${formatAmount(item.amount)}`, 'right'),
      ]),
      line('-'.repeat(columns), 'left'),
      line(`未稅金額 ${formatAmount(proof.totalAmount)}`, 'left'),
      line(`稅額 ${formatAmount(proof.taxAmount)}`, 'left'),
      line(`折讓合計 ${formatAmount(proof.totalAmount + proof.taxAmount)}`, 'left', true),
      line(''),
      line('買受人簽收：', 'left'),
      line('_'.repeat(columns), 'left'),
    ];

    return Buffer.concat([...header, ...body, ...footer()]);
  }

  const codes = await buildInvoiceCodeGraphics(proof.qrCodeLeft, proof.qrCodeRight, proof.barcode);
  const body = [
    line(proof.seller.name),
    line('電子發票證明聯', 'center', true),
    ...(proof.reprint ? [line('補印', 'center', true)] : []),
    line(proof.periodLabel),
    line(formatInvoiceNumber(proof.invoiceNumber), 'center', true),
    line(formatDateTime(proof.issuedAt)),
    line(`隨機碼 ${proof.randomNumber ?? '無'}`),
    line(`總計 ${formatAmount(proof.totalAmount)}`, 'center', true),
    line(`賣方統編 ${proof.seller.taxId ?? ''}`),
    ...(proof.buyer.taxId ? [line(`買方統編 ${proof.buyer.taxId}`)] : []),
    command(ESC, 0x61, ALIGN.center),
    rasterCommand(barcodeRaster(codes.barcodeBars, dots)),
    line(proof.barcode.trimEnd()),
    command(ESC, 0x61, ALIGN.center),
    rasterCommand(qrPairRaster(codes, dots)),
  ];

  return Buffer.concat([...header, ...body, ...footer()]);
};

/** 進紙並部分切紙（機型不支援切刀時會被忽略） */
const footer = (): readonly Buffer[] => [command(FS, 0x2e), command(ESC, 0x64, 4), command(GS, 0x56, 0x42, 0x00)];
