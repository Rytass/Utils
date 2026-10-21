import { existsSync } from 'fs';
import type { Font } from 'fontkit';
import { TurnkeyPrintError, TurnkeyPrintErrorCode } from '../turnkey-print-error';
import { PT_TO_MM, type TextMetrics } from './layout';
import { loadOptional, unwrapDefault } from './optional-modules';

export interface LoadedFont {
  readonly path: string;
  /** TTC 字型集合要指定的 family（PostScript 名稱），單一字型檔為 undefined */
  readonly family: string | undefined;
  /** fontkit 字型物件，供 PNG 取字形與量測 */
  readonly font: Font;
  readonly metrics: TextMetrics;
}

/** 行高（em 倍數） */
const LINE_HEIGHT_EM = 1.2;

/**
 * 載入中文字型（TTF、OTF 或 TTC）。pdfkit 內建字型沒有中文，所以 PDF、PNG、A4 都必須提供。
 * 找不到檔案或缺 fontkit 時丟 RENDERER_UNAVAILABLE。
 */
export const loadFont = async (fontPath: string): Promise<LoadedFont> => {
  if (!existsSync(fontPath)) {
    throw new TurnkeyPrintError(TurnkeyPrintErrorCode.RENDERER_UNAVAILABLE, `找不到中文字型檔：${fontPath}`);
  }

  const fontkit = unwrapDefault(await loadOptional('fontkit', '中文字型', () => import('fontkit')));
  const opened = fontkit.openSync(fontPath);
  const isCollection = 'fonts' in opened;
  const font: Font = isCollection ? opened.fonts[0] : opened;

  const toMm = (units: number, sizePt: number): number => (units / font.unitsPerEm) * sizePt * PT_TO_MM;

  const metrics: TextMetrics = {
    widthMm: (text, sizePt) =>
      toMm(
        font.layout(text).positions.reduce((sum, p) => sum + p.xAdvance, 0),
        sizePt,
      ),
    // CJK 字面幾乎佔滿一個 em，行高取 1.2 em 才不會上下行互相壓到
    lineHeightMm: sizePt => toMm(Math.max(font.ascent - font.descent, font.unitsPerEm * LINE_HEIGHT_EM), sizePt),
  };

  return {
    path: fontPath,
    family: isCollection ? font.postscriptName : undefined,
    font,
    metrics,
  };
};
