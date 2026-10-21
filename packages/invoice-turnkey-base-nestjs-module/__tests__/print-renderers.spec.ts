/**
 * @jest-environment node
 */

import iconv from 'iconv-lite';
import { TurnkeyProofFormat } from '../src/typings/turnkey-enums';
import { renderProof } from '../src/print/renderers';
import { loadOptional } from '../src/print/render/optional-modules';
import { TurnkeyPrintError, TurnkeyPrintErrorCode } from '../src/print/turnkey-print-error';
import { renderEscPos } from '../src/print/render/escpos-renderer';
import { buildAllowanceProof, buildInvoiceProof } from './print-fixtures';

const ESC_INIT = Buffer.from([0x1b, 0x40]);
const GS_RASTER = Buffer.from([0x1d, 0x76, 0x30]);
const CUT = Buffer.from([0x1d, 0x56, 0x42, 0x00]);

describe('ESC/POS renderer', () => {
  it('starts with ESC @ and ends with a partial cut', async () => {
    const body = await renderEscPos(buildInvoiceProof(), 57);

    expect(body.subarray(0, 2).equals(ESC_INIT)).toBe(true);
    expect(body.subarray(body.length - 4).equals(CUT)).toBe(true);
  });

  it('prints the invoice rasters through GS v 0 and Chinese text as Big5', async () => {
    const body = await renderEscPos(buildInvoiceProof(), 57);

    expect(body.includes(GS_RASTER)).toBe(true);
    expect(body.includes(iconv.encode('測試營業人', 'big5'))).toBe(true);
  });

  it('prints the allowance without barcode or QR rasters but with Big5 text', async () => {
    const body = await renderEscPos(buildAllowanceProof(), 57);

    expect(body.includes(iconv.encode('折讓證明單', 'big5'))).toBe(true);
    expect(body.includes(iconv.encode('買方統編 87654321', 'big5'))).toBe(true);
    expect(body.includes(GS_RASTER)).toBe(false);
  });

  it('renders through renderProof with the ESC_POS content type', async () => {
    const rendered = await renderProof(buildInvoiceProof(), {
      format: TurnkeyProofFormat.ESC_POS,
      paperWidthMm: 57,
    });

    expect(rendered.contentType).toBe('application/octet-stream');
    expect(rendered.format).toBe(TurnkeyProofFormat.ESC_POS);
  });
});

describe('RENDERER_UNAVAILABLE', () => {
  it('requires a font for PDF and PNG', async () => {
    await expect(renderProof(buildInvoiceProof(), { format: TurnkeyProofFormat.PDF })).rejects.toMatchObject({
      code: TurnkeyPrintErrorCode.RENDERER_UNAVAILABLE,
    });

    await expect(renderProof(buildInvoiceProof(), { format: TurnkeyProofFormat.PNG })).rejects.toBeInstanceOf(
      TurnkeyPrintError,
    );
  });

  it('requires a font for A4 PDF and allowance proofs', async () => {
    await expect(renderProof(buildAllowanceProof(), { format: TurnkeyProofFormat.A4_PDF })).rejects.toMatchObject({
      code: TurnkeyPrintErrorCode.RENDERER_UNAVAILABLE,
    });
  });

  it('reports a font file that does not exist', async () => {
    await expect(
      renderProof(buildInvoiceProof(), { format: TurnkeyProofFormat.PDF, fontPath: '/no/such/font.ttf' }),
    ).rejects.toThrow('找不到中文字型檔');
  });

  it('names the missing optional package in the message', async () => {
    const missing = loadOptional('no-such-optional-pkg-xyz', 'PDF 輸出', () => import('no-such-optional-pkg-xyz'));

    await expect(missing).rejects.toMatchObject({ code: TurnkeyPrintErrorCode.RENDERER_UNAVAILABLE });
    await expect(missing).rejects.toThrow('no-such-optional-pkg-xyz');
  });
});
