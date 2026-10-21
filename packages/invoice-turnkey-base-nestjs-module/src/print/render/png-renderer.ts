import type { PathCommand } from 'fontkit';
import { type DrawOp, type Page, PT_TO_MM, RECT_STROKE_MM, type TextOp } from './layout';
import { type Edge, fillEdges, Raster } from './raster';
import type { LoadedFont } from './metrics';
import { loadOptional, unwrapDefault } from './optional-modules';

/** 16 px/mm（約 406 dpi）：57 mm 紙寬約 912 px，Code 39 窄條 3 px 不會因取整數而變形 */
export const PNG_PIXELS_PER_MM = 16;

const CURVE_SEGMENTS = 8;

type Point = readonly [number, number];

/** 把字形輪廓（曲線）攤平成線段；座標已經換算成像素 */
const pathEdges = (commands: readonly PathCommand[], toPixel: (x: number, y: number) => Point): readonly Edge[] => {
  const contours = commands.reduce<{
    readonly done: readonly (readonly Point[])[];
    readonly current: readonly Point[];
  }>(
    (state, command) => {
      const args = command.args;

      switch (command.command) {
        case 'moveTo':
          return {
            done: state.current.length > 0 ? [...state.done, state.current] : state.done,
            current: [toPixel(args[0], args[1])],
          };
        case 'lineTo':
          return { done: state.done, current: [...state.current, toPixel(args[0], args[1])] };
        case 'quadraticCurveTo': {
          const [from] = state.current.slice(-1);
          const curve = Array.from({ length: CURVE_SEGMENTS }, (_, index) => {
            const t = (index + 1) / CURVE_SEGMENTS;
            const x =
              (1 - t) ** 2 * from[0] +
              2 * (1 - t) * t * toPixel(args[0], args[1])[0] +
              t ** 2 * toPixel(args[2], args[3])[0];

            const y =
              (1 - t) ** 2 * from[1] +
              2 * (1 - t) * t * toPixel(args[0], args[1])[1] +
              t ** 2 * toPixel(args[2], args[3])[1];

            return [x, y] as const;
          });

          return { done: state.done, current: [...state.current, ...curve] };
        }
        case 'bezierCurveTo': {
          const [from] = state.current.slice(-1);
          const c1 = toPixel(args[0], args[1]);
          const c2 = toPixel(args[2], args[3]);
          const end = toPixel(args[4], args[5]);
          const curve = Array.from({ length: CURVE_SEGMENTS }, (_, index) => {
            const t = (index + 1) / CURVE_SEGMENTS;
            const u = 1 - t;
            const x = u ** 3 * from[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * end[0];
            const y = u ** 3 * from[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * end[1];

            return [x, y] as const;
          });

          return { done: state.done, current: [...state.current, ...curve] };
        }
        case 'closePath':
          return { done: [...state.done, state.current], current: [] };
        default:
          return state;
      }
    },
    { done: [], current: [] },
  );

  const allContours = contours.current.length > 0 ? [...contours.done, contours.current] : contours.done;

  return allContours.flatMap(points =>
    points.flatMap((point, index) => {
      const next = points[(index + 1) % points.length];

      return point[1] === next[1] ? [] : [{ x0: point[0], y0: point[1], x1: next[0], y1: next[1] }];
    }),
  );
};

const drawText = (raster: Raster, loaded: LoadedFont, op: TextOp): void => {
  const { font } = loaded;
  const scale = (op.sizePt * PT_TO_MM * PNG_PIXELS_PER_MM) / font.unitsPerEm;
  const textWidth = loaded.metrics.widthMm(op.text, op.sizePt) * PNG_PIXELS_PER_MM;
  const boxX = op.x * PNG_PIXELS_PER_MM;
  const boxWidth = op.width * PNG_PIXELS_PER_MM;
  const startX =
    op.align === 'left'
      ? boxX
      : op.align === 'center'
        ? boxX + (boxWidth - textWidth) / 2
        : boxX + boxWidth - textWidth;

  const baseline = op.y * PNG_PIXELS_PER_MM + font.ascent * scale;
  const run = font.layout(op.text);

  run.glyphs.reduce((pen, glyph, index) => {
    const position = run.positions[index];
    const originX = pen + position.xOffset * scale;
    const originY = baseline - position.yOffset * scale;

    fillEdges(
      raster,
      pathEdges(glyph.path.commands, (x, y) => [originX + x * scale, originY - y * scale]),
    );

    return pen + position.xAdvance * scale;
  }, startX);
};

const mmToPx = (mm: number): number => Math.round(mm * PNG_PIXELS_PER_MM);

const fillRectMm = (raster: Raster, x: number, y: number, width: number, height: number): void =>
  raster.fillRect(mmToPx(x), mmToPx(y), mmToPx(x + width), mmToPx(y + height));

const drawOp = (raster: Raster, loaded: LoadedFont, op: DrawOp): void => {
  switch (op.kind) {
    case 'text':
      drawText(raster, loaded, op);

      return;
    case 'rect': {
      if (op.fill) {
        fillRectMm(raster, op.x, op.y, op.width, op.height);

        return;
      }

      const stroke = RECT_STROKE_MM;

      fillRectMm(raster, op.x, op.y, op.width, stroke);
      fillRectMm(raster, op.x, op.y + op.height - stroke, op.width, stroke);
      fillRectMm(raster, op.x, op.y, stroke, op.height);
      fillRectMm(raster, op.x + op.width - stroke, op.y, stroke, op.height);

      return;
    }
    case 'bitmap':
      op.rows.forEach((row, rowIndex) =>
        row.forEach((on, columnIndex) => {
          if (on) {
            fillRectMm(
              raster,
              op.x + columnIndex * op.cellWidth,
              op.y + rowIndex * op.cellHeight,
              op.cellWidth,
              op.cellHeight,
            );
          }
        }),
      );
  }
};

/** 把單頁版面畫成 PNG（RGBA、白底黑字） */
export const renderPng = async (page: Page, loaded: LoadedFont): Promise<Buffer> => {
  const { PNG } = unwrapDefault(await loadOptional('pngjs', 'PNG 輸出', () => import('pngjs')));
  const raster = new Raster(mmToPx(page.widthMm), mmToPx(page.heightMm));

  page.ops.forEach(op => drawOp(raster, loaded, op));

  const image = new PNG({ width: raster.width, height: raster.height });

  image.data = raster.toRgba();

  return PNG.sync.write(image);
};
