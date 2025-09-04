/**
 * 顏色亮度計算工具函數
 * 用於在檢視模式下創建 hover 效果
 */

/**
 * 將十六進制顏色轉換為 RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // 移除 # 符號
  const cleanHex = hex.replace('#', '');

  // 支援 3 位元和 6 位元的十六進制顏色
  const shorthandRegex = /^([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = cleanHex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);

  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * 將 RGB 轉換為十六進制顏色
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);

    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * 提高顏色亮度
 * @param color - 十六進制顏色字串 (例如: #ff0000)
 * @param percentage - 亮度提高的百分比 (例如: 15 表示提高 15%)
 * @returns 提高亮度後的十六進制顏色字串
 */
export function increaseBrightness(color: string, percentage: number): string {
  const rgb = hexToRgb(color);

  if (!rgb) {
    console.warn(`Invalid color format: ${color}`);

    return color;
  }

  // 計算亮度增加的因子
  const factor = 1 + percentage / 100;

  // 應用亮度增加，但不能超過 255
  const newR = Math.min(255, rgb.r * factor);
  const newG = Math.min(255, rgb.g * factor);
  const newB = Math.min(255, rgb.b * factor);

  return rgbToHex(newR, newG, newB);
}

/**
 * 創建 hover 效果顏色（亮度提高 15%）
 * @param color - 原始顏色
 * @returns hover 效果的顏色
 */
export function createHoverColor(color: string): string {
  return increaseBrightness(color, 25);
}
