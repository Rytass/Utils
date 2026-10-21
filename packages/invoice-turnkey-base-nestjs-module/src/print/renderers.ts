import { TurnkeyProofFormat } from '../typings/turnkey-enums';
import { layoutA4Allowance, layoutA4Invoice } from './render/a4-layout';
import { buildInvoiceCodeGraphics } from './render/codes';
import { renderEscPos } from './render/escpos-renderer';
import { type Page, type TextMetrics } from './render/layout';
import { type LoadedFont, loadFont } from './render/metrics';
import { renderPdf } from './render/pdf-renderer';
import { renderPng } from './render/png-renderer';
import { layoutThermalAllowance, layoutThermalInvoice } from './render/thermal-layout';
import { TurnkeyPrintError, TurnkeyPrintErrorCode } from './turnkey-print-error';
import type { TurnkeyProof, TurnkeyRenderedProof, TurnkeyRenderOptions } from './turnkey-print.types';

/** 熱感紙預設寬度（mm） */
export const DEFAULT_PAPER_WIDTH_MM = 57;

const requireFont = (fontPath: string | undefined, purpose: string): Promise<LoadedFont> => {
  if (!fontPath) {
    throw new TurnkeyPrintError(
      TurnkeyPrintErrorCode.RENDERER_UNAVAILABLE,
      `${purpose} 輸出需要中文字型：請設定 print.fontPath，或呼叫時傳入 fontPath（pdfkit 內建字型沒有中文）`,
    );
  }

  return loadFont(fontPath);
};

const thermalPage = async (proof: TurnkeyProof, paperWidthMm: number, metrics: TextMetrics): Promise<Page> => {
  if (proof.documentType === 'ALLOWANCE') return layoutThermalAllowance(proof, paperWidthMm, metrics);

  const codes = await buildInvoiceCodeGraphics(proof.qrCodeLeft, proof.qrCodeRight, proof.barcode);

  return layoutThermalInvoice(proof, codes, paperWidthMm, metrics);
};

const a4Pages = async (proof: TurnkeyProof, metrics: TextMetrics): Promise<readonly Page[]> => {
  if (proof.documentType === 'ALLOWANCE') return layoutA4Allowance(proof, metrics);

  const codes = await buildInvoiceCodeGraphics(proof.qrCodeLeft, proof.qrCodeRight, proof.barcode);

  return layoutA4Invoice(proof, codes, metrics);
};

/**
 * 證明聯與折讓證明單的渲染入口（JSON 由 service 直接處理，不經過這裡）。
 * PDF、PNG、A4_PDF 需要中文字型；ESC_POS 不需要字型，中文以 Big5 輸出。
 */
export const renderProof = async (
  proof: TurnkeyProof,
  options: TurnkeyRenderOptions,
): Promise<TurnkeyRenderedProof> => {
  const paperWidthMm = options.paperWidthMm ?? DEFAULT_PAPER_WIDTH_MM;

  switch (options.format) {
    case TurnkeyProofFormat.PDF: {
      const font = await requireFont(options.fontPath, '57 mm 熱感紙 PDF');
      const page = await thermalPage(proof, paperWidthMm, font.metrics);

      return {
        format: options.format,
        contentType: 'application/pdf',
        body: await renderPdf([page], font),
      };
    }
    case TurnkeyProofFormat.PNG: {
      const font = await requireFont(options.fontPath, '57 mm 熱感紙 PNG');
      const page = await thermalPage(proof, paperWidthMm, font.metrics);

      return {
        format: options.format,
        contentType: 'image/png',
        body: await renderPng(page, font),
      };
    }
    case TurnkeyProofFormat.A4_PDF: {
      const font = await requireFont(options.fontPath, 'A4 PDF');
      const pages = await a4Pages(proof, font.metrics);

      return {
        format: options.format,
        contentType: 'application/pdf',
        body: await renderPdf(pages, font),
      };
    }
    case TurnkeyProofFormat.ESC_POS:
      return {
        format: options.format,
        contentType: 'application/octet-stream',
        body: await renderEscPos(proof, paperWidthMm),
      };
    default:
      throw new TurnkeyPrintError(
        TurnkeyPrintErrorCode.RENDERER_UNAVAILABLE,
        `${options.format} 不是渲染器處理的格式（JSON 由 service 直接回傳）`,
      );
  }
};
