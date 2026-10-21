/** 單色點陣畫布，以 0～1 的墨量表示；供 PNG 與 ESC/POS 的點陣圖共用 */
export class Raster {
  readonly width: number;

  readonly height: number;

  private readonly ink: Float32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ink = new Float32Array(width * height);
  }

  /** 填滿 [x0, x1) × [y0, y1) 的整數像素範圍，超出畫布的部分會被裁切 */
  fillRect(x0: number, y0: number, x1: number, y1: number): void {
    const left = Math.max(0, x0);
    const right = Math.min(this.width, x1);
    const top = Math.max(0, y0);
    const bottom = Math.min(this.height, y1);

    for (let y = top; y < bottom; y += 1) {
      this.ink.fill(1, y * this.width + left, y * this.width + right);
    }
  }

  blend(x: number, y: number, alpha: number): void {
    const index = y * this.width + x;

    this.ink[index] = this.ink[index] + alpha * (1 - this.ink[index]);
  }

  isInk(x: number, y: number): boolean {
    return this.ink[y * this.width + x] >= 0.5;
  }

  /** RGBA 像素（白底黑字） */
  toRgba(): Buffer {
    const rgba = Buffer.alloc(this.width * this.height * 4, 255);

    for (let index = 0; index < this.ink.length; index += 1) {
      const value = Math.round(255 * (1 - this.ink[index]));
      const offset = index * 4;

      rgba[offset] = value;
      rgba[offset + 1] = value;
      rgba[offset + 2] = value;
    }

    return rgba;
  }
}

export interface Edge {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

interface Crossing {
  readonly x: number;
  readonly dir: 1 | -1;
}

/** 每個像素列取 4 條子掃描線，水平方向以實際重疊長度計算覆蓋率 */
const SUB_SCANLINES = 4;

const spansOf = (crossings: readonly Crossing[]): readonly (readonly [number, number])[] =>
  crossings.reduce<{
    readonly winding: number;
    readonly start: number;
    readonly spans: readonly (readonly [number, number])[];
  }>(
    (state, crossing) => {
      const next = state.winding + crossing.dir;

      if (state.winding === 0 && next !== 0) return { winding: next, start: crossing.x, spans: state.spans };

      if (state.winding !== 0 && next === 0) {
        return { winding: 0, start: state.start, spans: [...state.spans, [state.start, crossing.x]] };
      }

      return { ...state, winding: next };
    },
    { winding: 0, start: 0, spans: [] },
  ).spans;

const accumulate = (coverage: Float32Array, originX: number, from: number, to: number, weight: number): void => {
  const first = Math.max(originX, Math.floor(from));
  const last = Math.min(originX + coverage.length - 1, Math.floor(to));

  for (let column = first; column <= last; column += 1) {
    const overlap = Math.min(to, column + 1) - Math.max(from, column);

    if (overlap > 0) coverage[column - originX] += overlap * weight;
  }
};

/** nonzero 規則的掃描線填色，用來填字形輪廓（抗鋸齒） */
export const fillEdges = (raster: Raster, edges: readonly Edge[]): void => {
  if (edges.length === 0) return;

  const xs = edges.flatMap(edge => [edge.x0, edge.x1]);
  const ys = edges.flatMap(edge => [edge.y0, edge.y1]);
  const originX = Math.max(0, Math.floor(Math.min(...xs)));
  const endX = Math.min(raster.width, Math.ceil(Math.max(...xs)));
  const originY = Math.max(0, Math.floor(Math.min(...ys)));
  const endY = Math.min(raster.height, Math.ceil(Math.max(...ys)));

  if (endX <= originX) return;

  const coverage = new Float32Array(endX - originX);

  for (let row = originY; row < endY; row += 1) {
    coverage.fill(0);

    for (let sub = 0; sub < SUB_SCANLINES; sub += 1) {
      const sy = row + (sub + 0.5) / SUB_SCANLINES;
      const crossings = edges
        .filter(edge => edge.y0 <= sy !== edge.y1 <= sy)
        .map(edge => ({
          x: edge.x0 + ((sy - edge.y0) * (edge.x1 - edge.x0)) / (edge.y1 - edge.y0),
          dir: (edge.y1 > edge.y0 ? 1 : -1) as 1 | -1,
        }))
        .sort((a, b) => a.x - b.x);

      spansOf(crossings).forEach(([from, to]) => accumulate(coverage, originX, from, to, 1 / SUB_SCANLINES));
    }

    coverage.forEach((value, index) => {
      if (value > 0) raster.blend(originX + index, row, Math.min(1, value));
    });
  }
};
