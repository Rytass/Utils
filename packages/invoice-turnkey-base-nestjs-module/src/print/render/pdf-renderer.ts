import type { LoadedFont } from './metrics';
import { type BitRows, type DrawOp, type Page, PT_TO_MM, RECT_STROKE_MM } from './layout';
import { loadOptional } from './optional-modules';

const PT_PER_MM = 1 / PT_TO_MM;
/** 點陣格子之間的重疊量（pt），避免相鄰格子在閱讀器中出現細縫 */
const CELL_OVERLAP_PT = 0.1;

const toPt = (mm: number): number => mm * PT_PER_MM;

export const runsOf = (row: readonly boolean[]): readonly { readonly start: number; readonly length: number }[] =>
  row.reduce<readonly { readonly start: number; readonly length: number }[]>((runs, on, index) => {
    if (!on) return runs;

    const last = runs[runs.length - 1];

    return last && last.start + last.length === index
      ? [...runs.slice(0, -1), { start: last.start, length: last.length + 1 }]
      : [...runs, { start: index, length: 1 }];
  }, []);

const drawBitmap = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  cellWidth: number,
  cellHeight: number,
  rows: BitRows,
): void => {
  rows.forEach((row, rowIndex) => {
    runsOf(row).forEach(run => {
      doc
        .rect(
          toPt(x + run.start * cellWidth),
          toPt(y + rowIndex * cellHeight),
          toPt(run.length * cellWidth) + CELL_OVERLAP_PT,
          toPt(cellHeight) + CELL_OVERLAP_PT,
        )
        .fill();
    });
  });
};

const drawOp = (doc: PDFKit.PDFDocument, op: DrawOp): void => {
  switch (op.kind) {
    case 'text': {
      // 不傳 width：pdfkit 只要有 width 就會自動換行（lineBreak: false 無效），換行由版面層負責，這裡只做對齊
      // pdfkit 預設字級為 12pt，必須先設定，否則寬度與版面量測不符
      doc.fontSize(op.sizePt);

      const textWidth = doc.widthOfString(op.text);
      const offset = { left: 0, center: (toPt(op.width) - textWidth) / 2, right: toPt(op.width) - textWidth }[op.align];

      doc.text(op.text, toPt(op.x) + offset, toPt(op.y), { lineBreak: false });

      return;
    }
    case 'rect':
      doc.lineWidth(toPt(RECT_STROKE_MM)).rect(toPt(op.x), toPt(op.y), toPt(op.width), toPt(op.height));

      if (op.fill) doc.fill();
      else doc.stroke();

      return;
    case 'bitmap':
      drawBitmap(doc, op.x, op.y, op.cellWidth, op.cellHeight, op.rows);
  }
};

/** 以 pdfkit 輸出向量 PDF；每一頁的尺寸各自設定（熱感紙為單頁，A4 為多頁） */
export const renderPdf = async (pages: readonly Page[], font: LoadedFont): Promise<Buffer> => {
  const { default: PDFDocument } = await loadOptional('pdfkit', 'PDF 輸出', () => import('pdfkit'));
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
  const chunks: Buffer[] = [];

  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  pages.forEach(page => {
    doc.addPage({ size: [toPt(page.widthMm), toPt(page.heightMm)], margin: 0 });

    if (font.family) doc.font(font.path, font.family);
    else doc.font(font.path);
    page.ops.forEach(op => drawOp(doc, op));
  });

  doc.end();

  return finished;
};
