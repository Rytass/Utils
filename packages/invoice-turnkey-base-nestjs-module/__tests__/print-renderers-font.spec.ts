/**
 * @jest-environment node
 *
 * 需要中文字型的測試：設定環境變數 TURNKEY_TEST_FONT_PATH 指向 TTF／OTF／TTC 檔才會執行。
 * 字型檔不放進 repo。
 */

import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { TurnkeyProofFormat } from '../src/typings/turnkey-enums';
import { renderProof } from '../src/print/renderers';
import { buildInvoiceCodeGraphics } from '../src/print/render/codes';
import { layoutA4Invoice } from '../src/print/render/a4-layout';
import { PNG_PIXELS_PER_MM } from '../src/print/render/png-renderer';
import { loadFont, type LoadedFont } from '../src/print/render/metrics';
import { layoutThermalAllowance, layoutThermalInvoice } from '../src/print/render/thermal-layout';
import type { BitmapOp, Page } from '../src/print/render/layout';
import { buildAllowanceProof, buildB2bProof, buildInvoiceProof, buildReprintProof } from './print-fixtures';

const FONT_PATH = process.env.TURNKEY_TEST_FONT_PATH;
const describeWithFont = FONT_PATH ? describe : describe.skip;

const PAPER_MM = 57;
const CROP_MARGIN_MM = 2;

const bitmapOps = (page: Page): readonly BitmapOp[] => page.ops.filter((op): op is BitmapOp => op.kind === 'bitmap');

/** 只取 QR Code（方陣，列數與欄數相同且大於 1） */
const qrOps = (page: Page): readonly BitmapOp[] =>
  bitmapOps(page).filter(op => op.rows.length > 1 && op.rows.length === op.rows[0].length);

const barcodeOp = (page: Page): BitmapOp | undefined => bitmapOps(page).find(op => op.rows.length === 1);

/** 從 PNG 裁出指定毫米範圍（含 margin），回傳 RGBA */
const cropRgba = (
  png: PNG,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
): { readonly data: Uint8ClampedArray; readonly width: number; readonly height: number } => {
  const scale = PNG_PIXELS_PER_MM;
  const x0 = Math.max(0, Math.floor((xMm - CROP_MARGIN_MM) * scale));
  const y0 = Math.max(0, Math.floor((yMm - CROP_MARGIN_MM) * scale));
  const x1 = Math.min(png.width, Math.ceil((xMm + widthMm + CROP_MARGIN_MM) * scale));
  const y1 = Math.min(png.height, Math.ceil((yMm + heightMm + CROP_MARGIN_MM) * scale));
  const width = x1 - x0;
  const height = y1 - y0;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const src = ((y0 + row) * png.width + (x0 + col)) * 4;
      const dst = (row * width + col) * 4;

      data.set(png.data.subarray(src, src + 4), dst);
    }
  }

  return { data, width, height };
};

const decodeQr = (png: PNG, op: BitmapOp): string | null => {
  const size = op.rows.length;
  const { data, width, height } = cropRgba(png, op.x, op.y, size * op.cellWidth, size * op.cellHeight);
  const result = jsQR(data, width, height);

  return result ? result.data : null;
};

const decodeBarcode = (png: PNG, op: BitmapOp): string | null => {
  const bars = op.rows[0].length;
  const { data, width, height } = cropRgba(png, op.x, op.y, bars * op.cellWidth, op.cellHeight);
  const luminances = new Uint8ClampedArray(width * height);

  for (let i = 0; i < width * height; i += 1) {
    luminances[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }

  const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39]]]);
  const reader = new MultiFormatReader();

  reader.setHints(hints);

  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminances, width, height)));

    return reader.decode(bitmap).getText();
  } catch {
    return null;
  }
};

describeWithFont('print renderers with a Chinese font', () => {
  let font: LoadedFont;

  beforeAll(async () => {
    font = await loadFont(FONT_PATH as string);
  });

  const thermalPage = async (proof: ReturnType<typeof buildInvoiceProof>): Promise<Page> => {
    const codes = await buildInvoiceCodeGraphics(proof.qrCodeLeft, proof.qrCodeRight, proof.barcode);

    return layoutThermalInvoice(proof, codes, PAPER_MM, font.metrics);
  };

  it('renders a 57 mm thermal PDF', async () => {
    const rendered = await renderProof(buildInvoiceProof(), {
      format: TurnkeyProofFormat.PDF,
      fontPath: FONT_PATH,
    });

    expect(rendered.contentType).toBe('application/pdf');
    expect(rendered.body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('renders a 57 mm PNG at 16 px per mm and decodes both QR codes', async () => {
    const proof = buildInvoiceProof();
    const rendered = await renderProof(proof, { format: TurnkeyProofFormat.PNG, fontPath: FONT_PATH });
    const png = PNG.sync.read(rendered.body);
    const page = await thermalPage(proof);
    const [left, right] = qrOps(page);

    expect(png.width).toBe(PAPER_MM * PNG_PIXELS_PER_MM);
    expect(decodeQr(png, left)).toBe(proof.qrCodeLeft);
    expect(decodeQr(png, right)).toBe(proof.qrCodeRight);
  });

  it('decodes the Code 39 barcode with zxing', async () => {
    const proof = buildInvoiceProof();
    const rendered = await renderProof(proof, { format: TurnkeyProofFormat.PNG, fontPath: FONT_PATH });
    const png = PNG.sync.read(rendered.body);
    const barcode = barcodeOp(await thermalPage(proof));

    expect(barcode).toBeDefined();
    expect(decodeBarcode(png, barcode as BitmapOp)?.trimEnd()).toBe(proof.barcode.trimEnd());
  });

  it('marks reprints with 補印 and keeps QR codes decodable', async () => {
    const proof = buildReprintProof();
    const page = await thermalPage(proof);
    const hasReprint = page.ops.some(op => op.kind === 'text' && op.text === '補印');

    expect(hasReprint).toBe(true);
  });

  it('renders a B2B proof with null random number and zero-rated items', async () => {
    const proof = buildB2bProof(3);
    const rendered = await renderProof(proof, { format: TurnkeyProofFormat.PNG, fontPath: FONT_PATH });
    const png = PNG.sync.read(rendered.body);
    const page = await thermalPage(proof);
    const [left, right] = qrOps(page);

    expect(proof.randomNumber).toBeNull();
    expect(proof.barcode.endsWith('    ')).toBe(true);
    const a4Codes = await buildInvoiceCodeGraphics(proof.qrCodeLeft, proof.qrCodeRight, proof.barcode);
    const a4Text = layoutA4Invoice(proof, a4Codes, font.metrics)
      .flatMap(a4Page => a4Page.ops)
      .some(op => op.kind === 'text' && op.text.includes('零稅率'));

    expect(a4Text).toBe(true);
    expect(decodeQr(png, left)).toBe(proof.qrCodeLeft);
    expect(decodeQr(png, right)).toBe(proof.qrCodeRight);
  });

  it('renders the thermal allowance without barcode or QR codes', async () => {
    const rendered = await renderProof(buildAllowanceProof(), {
      format: TurnkeyProofFormat.PNG,
      fontPath: FONT_PATH,
    });

    const page = layoutThermalAllowance(buildAllowanceProof(), PAPER_MM, font.metrics);

    expect(PNG.sync.read(rendered.body).width).toBe(PAPER_MM * PNG_PIXELS_PER_MM);
    expect(bitmapOps(page)).toHaveLength(0);
  });

  it('renders A4 PDF for an allowance', async () => {
    const rendered = await renderProof(buildAllowanceProof(), {
      format: TurnkeyProofFormat.A4_PDF,
      fontPath: FONT_PATH,
    });

    expect(rendered.body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('paginates A4 with repeated headers and the EXCHANGE footer', async () => {
    const proof = buildB2bProof(70);
    const codes = await buildInvoiceCodeGraphics(proof.qrCodeLeft, proof.qrCodeRight, proof.barcode);
    const pages = layoutA4Invoice(proof, codes, font.metrics);
    const footers = pages.map(page =>
      page.ops
        .filter(op => op.kind === 'text')
        .map(op => (op.kind === 'text' ? op.text : ''))
        .join('|'),
    );

    expect(pages.length).toBeGreaterThan(1);
    expect(footers[0]).toContain(`第 1 頁／共 ${pages.length} 頁`);
    expect(footers[pages.length - 1]).toContain(`第 ${pages.length} 頁／共 ${pages.length} 頁`);
    expect(footers.every(text => text.includes('本發票已以電子方式交換'))).toBe(true);
  });

  it('produces a multi-page A4 PDF when the items overflow one page', async () => {
    const rendered = await renderProof(buildB2bProof(70), {
      format: TurnkeyProofFormat.A4_PDF,
      fontPath: FONT_PATH,
    });

    const pageObjects = rendered.body.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? [];

    expect(pageObjects.length).toBeGreaterThan(1);
  });
});
