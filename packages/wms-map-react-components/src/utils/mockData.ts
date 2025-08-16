import {
  Map,
  MapBackground,
  MapRectangleRange,
  MapPolygonRange,
  MapRangeType,
} from '../../typings';

/**
 * Mock API 資料 - 模擬從後端 API 接收到的地圖資料
 * 這個格式與「儲存」時輸出的格式完全相同
 */
export const mockMapData: Map = {
  id: 'warehouse-map-001',
  backgrounds: [
    // 倉庫平面圖背景
    {
      id: 'bg-warehouse-floor-1',
      filename: 'warehouse-floor-plan.png',
      x: 50,
      y: 30,
    },
    // 倉庫分區圖背景
    {
      id: 'bg-warehouse-zones',
      filename: 'warehouse-zones.jpg',
      x: 400,
      y: 200,
    },
  ],
  ranges: [
    // 矩形範圍 - 收貨區
    {
      id: 'range-receiving-area',
      type: MapRangeType.RECTANGLE,
      color: '#22c55e', // 綠色
      x: 100,
      y: 80,
      width: 150,
      height: 100,
      text: '收貨區 A',
    } as MapRectangleRange,

    // 矩形範圍 - 儲存區 B
    {
      id: 'range-storage-b',
      type: MapRangeType.RECTANGLE,
      color: '#3b82f6', // 藍色
      x: 300,
      y: 120,
      width: 200,
      height: 80,
      text: '儲存區 B',
    } as MapRectangleRange,

    // 矩形範圍 - 出貨區
    {
      id: 'range-shipping-area',
      type: MapRangeType.RECTANGLE,
      color: '#f59e0b', // 橙色
      x: 150,
      y: 250,
      width: 180,
      height: 90,
      text: '出貨區',
    } as MapRectangleRange,

    // 多邊形範圍 - 危險品存放區（不規則形狀）
    {
      id: 'range-hazmat-zone',
      type: MapRangeType.POLYGON,
      color: '#ef4444', // 紅色
      points: [
        { x: 450, y: 100 },
        { x: 520, y: 90 },
        { x: 540, y: 140 },
        { x: 515, y: 180 },
        { x: 470, y: 170 },
        { x: 450, y: 130 },
      ],
      text: '危險品區',
    } as MapPolygonRange,

    // 多邊形範圍 - 通道（L 型）
    {
      id: 'range-main-corridor',
      type: MapRangeType.POLYGON,
      color: '#6b7280', // 灰色
      points: [
        { x: 80, y: 200 },
        { x: 120, y: 200 },
        { x: 120, y: 350 },
        { x: 400, y: 350 },
        { x: 400, y: 310 },
        { x: 80, y: 310 },
      ],
      text: '主通道',
    } as MapPolygonRange,

    // 多邊形範圍 - 辦公區域（三角形）
    {
      id: 'range-office-area',
      type: MapRangeType.POLYGON,
      color: '#8b5cf6', // 紫色
      points: [
        { x: 500, y: 250 },
        { x: 580, y: 250 },
        { x: 540, y: 320 },
      ],
      text: '辦公區',
    } as MapPolygonRange,

    // 矩形範圍 - 冷凍庫
    {
      id: 'range-freezer',
      type: MapRangeType.RECTANGLE,
      color: '#06b6d4', // 青色
      x: 350,
      y: 50,
      width: 80,
      height: 60,
      text: '冷凍庫',
    } as MapRectangleRange,

    // 多邊形範圍 - 品檢區（五邊形）
    {
      id: 'range-quality-check',
      type: MapRangeType.POLYGON,
      color: '#f97316', // 橙色
      points: [
        { x: 200, y: 400 },
        { x: 250, y: 390 },
        { x: 270, y: 430 },
        { x: 230, y: 460 },
        { x: 180, y: 440 },
      ],
      text: '品檢區',
    } as MapPolygonRange,
  ],
};

/**
 * 更簡單的 Mock 資料 - 用於基本測試
 */
export const simpleMapData: Map = {
  id: 'simple-test-map',
  backgrounds: [
    {
      id: 'simple-bg-1',
      filename: 'simple-background.png',
      x: 100,
      y: 50,
    },
  ],
  ranges: [
    // 一個簡單的矩形
    {
      id: 'simple-rect-1',
      type: MapRangeType.RECTANGLE,
      color: '#3b82f6',
      x: 150,
      y: 100,
      width: 100,
      height: 80,
      text: '測試矩形',
    } as MapRectangleRange,

    // 一個簡單的三角形
    {
      id: 'simple-poly-1',
      type: MapRangeType.POLYGON,
      color: '#ef4444',
      points: [
        { x: 300, y: 120 },
        { x: 350, y: 120 },
        { x: 325, y: 170 },
      ],
      text: '測試三角形',
    } as MapPolygonRange,
  ],
};

/**
 * 空的 Map 資料 - 測試空狀態
 */
export const emptyMapData: Map = {
  id: 'empty-map',
  backgrounds: [],
  ranges: [],
};

/**
 * 大量資料的 Mock - 性能測試用
 */
export const largeMapData: Map = {
  id: 'performance-test-map',
  backgrounds: Array.from({ length: 5 }, (_, i) => ({
    id: `bg-${i + 1}`,
    filename: `background-${i + 1}.png`,
    x: 100 + i * 200,
    y: 50 + i * 30,
  })),
  ranges: [
    // 生成 20 個矩形
    ...Array.from(
      { length: 20 },
      (_, i) =>
        ({
          id: `rect-${i + 1}`,
          type: MapRangeType.RECTANGLE,
          color: ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'][i % 5],
          x: 100 + (i % 5) * 120,
          y: 100 + Math.floor(i / 5) * 100,
          width: 80,
          height: 60,
          text: `矩形 ${i + 1}`,
        }) as MapRectangleRange,
    ),

    // 生成 10 個多邊形
    ...Array.from(
      { length: 10 },
      (_, i) =>
        ({
          id: `poly-${i + 1}`,
          type: MapRangeType.POLYGON,
          color: ['#06b6d4', '#f97316', '#6b7280', '#ec4899', '#84cc16'][i % 5],
          points: [
            { x: 200 + i * 60, y: 500 + i * 10 },
            { x: 240 + i * 60, y: 490 + i * 10 },
            { x: 250 + i * 60, y: 520 + i * 10 },
            { x: 220 + i * 60, y: 540 + i * 10 },
            { x: 190 + i * 60, y: 530 + i * 10 },
          ],
          text: `多邊形 ${i + 1}`,
        }) as MapPolygonRange,
    ),
  ],
};
