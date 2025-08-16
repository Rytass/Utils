// This file is the entry point for the WMS Map React Components package.

export * from './typings';
export { default as WmsMapModal } from './src/WmsMapModal';

// 導出資料轉換工具函數
export {
  transformNodeToClickInfo,
  transformNodesToMapData,
  logMapData,
  logNodeData,
} from './src/utils/mapDataTransform';

// 導出 API 資料轉換工具函數
export {
  transformApiDataToNodes,
  validateMapData,
  loadMapDataFromApi,
  calculatePolygonBounds,
  calculateNodeZIndex,
} from './src/utils/apiDataTransform';

// 導出 Mock 資料
export {
  mockMapData,
  simpleMapData,
  emptyMapData,
  largeMapData,
} from './src/utils/mockData';

// 導出測試工具函數 (可選)
export {
  testDataTransformation,
  testDifferentDataSizes,
  testApiLoad,
  generateTestNodes,
  exportTestData,
  validateTransformationResult,
} from './test/testMapData';
