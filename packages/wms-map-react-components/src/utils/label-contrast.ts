/**
 * 範圍標籤字色：依標籤實際壓著的顏色（底圖像素或畫布色，再疊上範圍自己的半透明填色），
 * 以 WCAG 對比度在深色與淺色之間選一個。
 */

export type LabelTone = 'dark' | 'light';

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 沒有底圖覆蓋處的畫布色（與 ReactFlowCanvas 的背景一致）。 */
export const CANVAS_BACKGROUND: Rgb = { r: 0xf5, g: 0xf5, b: 0xf5 };
/** 範圍填色的 alpha（`${color}33`）。 */
export const RANGE_FILL_ALPHA = 0x33 / 0xff;

/** 兩種字色以 Mezzanine 文字 token 為準，未載入 token 時退回相同色值。 */
export const LABEL_TONE_COLORS: Readonly<Record<LabelTone, string>> = {
  dark: 'var(--mzn-color-text-neutral-solid, #191e26)',
  light: 'var(--mzn-color-text-fixed-light, #ffffff)',
};

const DARK: Rgb = { r: 0x19, g: 0x1e, b: 0x26 };
const LIGHT: Rgb = { r: 255, g: 255, b: 255 };

export const mixRgb = (under: Rgb, over: Rgb, alpha: number): Rgb => ({
  r: under.r * (1 - alpha) + over.r * alpha,
  g: under.g * (1 - alpha) + over.g * alpha,
  b: under.b * (1 - alpha) + over.b * alpha,
});

const channel = (value: number): number => {
  const c = value / 255;

  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = ({ r, g, b }: Rgb): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export const contrastRatio = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
};

export const parseHexColor = (hex: string): Rgb | null => {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());

  if (!match) return null;

  const digits =
    match[1].length === 3
      ? match[1]
          .split('')
          .map(d => d + d)
          .join('')
      : match[1];

  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
};

/**
 * 標籤在 `backdrop` 上、疊了範圍填色後讀起來最清楚的字色。
 * `fillOpacity` 是填色實際的不透明度（填色 alpha × 範圍節點的 opacity）；標籤本身不透明。
 */
export const pickLabelTone = (
  backdrop: Rgb,
  rangeColor: Rgb | null,
  fillOpacity: number = RANGE_FILL_ALPHA,
): LabelTone => {
  const behind = rangeColor ? mixRgb(backdrop, rangeColor, fillOpacity) : backdrop;

  return contrastRatio(DARK, behind) >= contrastRatio(LIGHT, behind) ? 'dark' : 'light';
};

/** 標籤置中，取範圍中間三分之一作為取樣區。 */
export const labelSampleArea = (box: Box): Box => ({
  x: box.x + box.width / 3,
  y: box.y + box.height / 3,
  width: Math.max(box.width / 3, 1),
  height: Math.max(box.height / 3, 1),
});

/** 底圖以 `object-fit: contain` 畫在節點框內；回傳影像實際佔據的範圍。 */
export const containedFrame = (frame: Box, aspect: number): Box => {
  if (!(aspect > 0) || !(frame.width > 0) || !(frame.height > 0)) return frame;

  const width = Math.min(frame.width, frame.height * aspect);
  const height = width / aspect;

  return { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height };
};

export const boxesOverlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export interface PixelSample {
  /** RGBA，逐列排列（同 ImageData.data）。 */
  readonly pixels: ArrayLike<number>;
  readonly width: number;
  readonly height: number;
}

/** 一張畫在 `frame`（地圖座標）上的影像，在 `area` 範圍內的平均色；透明處視為畫布色。 */
export const averageColorOver = (sample: PixelSample, frame: Box, area: Box): Rgb | null => {
  const sx = sample.width / frame.width;
  const sy = sample.height / frame.height;
  const x0 = Math.max(0, Math.floor((area.x - frame.x) * sx));
  const y0 = Math.max(0, Math.floor((area.y - frame.y) * sy));
  const x1 = Math.min(sample.width, Math.ceil((area.x + area.width - frame.x) * sx));
  const y1 = Math.min(sample.height, Math.ceil((area.y + area.height - frame.y) * sy));

  if (x1 <= x0 || y1 <= y0) return null;

  const rows = Array.from({ length: y1 - y0 }, (_, i) => y0 + i);
  const columns = Array.from({ length: x1 - x0 }, (_, i) => x0 + i);
  const total = rows.reduce(
    (sum, y) =>
      columns.reduce((acc, x) => {
        const i = (y * sample.width + x) * 4;
        const pixel = mixRgb(
          CANVAS_BACKGROUND,
          { r: sample.pixels[i], g: sample.pixels[i + 1], b: sample.pixels[i + 2] },
          sample.pixels[i + 3] / 255,
        );

        return { r: acc.r + pixel.r, g: acc.g + pixel.g, b: acc.b + pixel.b, n: acc.n + 1 };
      }, sum),
    { r: 0, g: 0, b: 0, n: 0 },
  );

  return { r: total.r / total.n, g: total.g / total.n, b: total.b / total.n };
};
