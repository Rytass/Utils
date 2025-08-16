// This file is the entry point for the WMS Map React Components package.

export * from './typings';
export { default as WmsMapModal } from './src/WmsMapModal';

// 導出點擊資訊轉換工具函數
export { transformNodeToClickInfo } from './src/utils/mapDataTransform';
