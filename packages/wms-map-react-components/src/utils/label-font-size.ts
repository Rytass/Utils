/**
 * 範圍標籤字級：以範圍大小決定（地圖座標），再用畫面像素的上下限夾住，
 * 縮小地圖時仍看得到、放大時不會大到失控。
 */

/** 畫面上的最小字級（px）。 */
export const LABEL_MIN_SCREEN_PX = 11;
/** 畫面上的最大字級（px）。 */
export const LABEL_MAX_SCREEN_PX = 32;
/** 粗體英數字的平均字寬約為字級的 0.62 倍。 */
const CHAR_WIDTH_RATIO = 0.62;
/** 標籤最多佔範圍寬度的 90%、高度的 40%。 */
const MAX_WIDTH_SHARE = 0.9;
const MAX_HEIGHT_SHARE = 0.4;

/** 能放進範圍內的字級（地圖座標）。 */
export const fitLabelFontSize = (width: number, height: number, label: string): number => {
  const length = Math.max(label.length, 1);

  return Math.max(Math.min((width * MAX_WIDTH_SHARE) / (length * CHAR_WIDTH_RATIO), height * MAX_HEIGHT_SHARE), 0);
};

/**
 * CSS font-size：放得下的字級，夾在畫面最小／最大像素之間。
 * 畫布在 `--wms-map-zoom` 提供目前縮放比例；節點在地圖座標內，所以畫面像素要除以縮放。
 */
export const labelFontSizeCss = (width: number, height: number, label: string): string =>
  `clamp(calc(${LABEL_MIN_SCREEN_PX}px / var(--wms-map-zoom, 1)), ${fitLabelFontSize(width, height, label).toFixed(
    2,
  )}px, calc(${LABEL_MAX_SCREEN_PX}px / var(--wms-map-zoom, 1)))`;
