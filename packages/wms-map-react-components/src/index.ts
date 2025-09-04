// This file is the entry point for the WMS Map React Components package.

export * from './typings';
export * from './types';
export { default as WMSMapModal } from './components/modal/wms-map-modal-container';

// 導出資料轉換工具函數
export { transformNodeToClickInfo, transformNodesToMapData, logMapData, logNodeData } from './utils/map-data-transform';

// 導出 API 資料轉換工具函數
export {
  transformApiDataToNodes,
  validateMapData,
  loadMapDataFromApi,
  calculatePolygonBounds,
  calculateNodeZIndex,
} from './utils/api-data-transform';
