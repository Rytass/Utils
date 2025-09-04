/**
 * Mock 圖片生成工具 - 僅用於 Storybook 展示和開發環境
 */

// 緩存圖片 URL，確保相同檔名總是返回相同 URL
const imageUrlCache: { [key: string]: string } = {};

/**
 * 生成模擬圖片 URL
 * 專門用於 Storybook 和測試環境，生產環境應該使用真實的圖片 URL
 */
export const generateMockImageUrl = (filename: string): string => {
  // 檢查快取中是否已有此檔名的 URL
  if (imageUrlCache[filename]) {
    return imageUrlCache[filename];
  }

  // 生成固定的種子，基於檔名確保穩定性
  const generateSeed = (name: string): number => {
    const hash = name.split('').reduce((acc, char, i) => {
      const charCode = name.charCodeAt(i);
      const newHash = (acc << 5) - acc + charCode;

      return newHash & newHash; // Convert to 32-bit integer
    }, 0);

    return Math.abs(hash);
  };

  const seed = generateSeed(filename);

  // 使用不同的圖片來模擬倉庫平面圖和分區圖
  const imageMappings: { [key: string]: string } = {
    // 使用 Picsum Photos，固定種子確保穩定
    'warehouse-floor-plan.png': `https://picsum.photos/seed/${seed + 1}/300/200?blur=1`,
    'warehouse-zones.jpg': `https://picsum.photos/seed/${seed + 2}/400/250?blur=1`,
    'simple-background.png': `https://picsum.photos/seed/${seed + 3}/250/180?blur=1`,
    'background-1.png': `https://picsum.photos/seed/${seed + 4}/280/200?blur=1`,
    'background-2.png': `https://picsum.photos/seed/${seed + 5}/320/220?blur=1`,
    'background-3.png': `https://picsum.photos/seed/${seed + 6}/300/210?blur=1`,
    'background-4.png': `https://picsum.photos/seed/${seed + 7}/350/230?blur=1`,
    'background-5.png': `https://picsum.photos/seed/${seed + 8}/290/190?blur=1`,
    'polygon-test-background.png': `https://picsum.photos/seed/${seed + 9}/400/300?blur=1`,
  };

  // 如果有對應的圖片映射，使用它；否則生成一個預設圖片
  const finalUrl =
    imageMappings[filename] ||
    (() => {
      // 預設使用 placeholder 服務生成圖片
      const width = 300;
      const height = 200;
      const text = encodeURIComponent(filename.split('.')[0]);

      // 根據檔案名稱生成不同的背景色（較柔和的顏色）
      const colors = ['E8F4FD', 'F0F9E8', 'FFF8E1', 'FCE4EC', 'F3E5F5', 'E0F2F1'];

      const colorIndex = filename.length % colors.length;
      const bgColor = colors[colorIndex];
      const textColor = '757575'; // 灰色文字

      return `https://via.placeholder.com/${width}x${height}/${bgColor}/${textColor}?text=${text}`;
    })();

  // 緩存 URL
  imageUrlCache[filename] = finalUrl;

  return finalUrl;
};

/**
 * 清除圖片 URL 緩存（測試用）
 */
export const clearImageUrlCache = (): void => {
  Object.keys(imageUrlCache).forEach(key => delete imageUrlCache[key]);
};
