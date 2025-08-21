import { Node } from '@xyflow/react';
import {
  Map,
  MapBackground,
  MapRectangleRange,
  MapPolygonRange,
  MapRangeType,
} from '../../typings';

/**
 * 將 API 資料轉換為 React Flow 節點格式
 * 這個函數是 transformNodesToMapData 的反向操作
 */
export const transformApiDataToNodes = (
  mapData: Map,
  imageUrlGenerator?: (filename: string) => string,
): Node[] => {
  const nodes: Node[] = [];
  let zIndexCounter = 1;

  // 轉換背景圖片為 ImageNode
  mapData.backgrounds.forEach((background: MapBackground) => {
    // 如果沒有提供 imageUrlGenerator，則使用 filename 作為 URL (生產環境)
    const imageUrl = imageUrlGenerator
      ? imageUrlGenerator(background.filename)
      : background.filename; // 生產環境應該直接使用真實 URL

    const imageNode: Node = {
      id: background.id,
      type: 'imageNode',
      position: {
        x: background.x,
        y: background.y,
      },
      data: {
        imageUrl,
        fileName: background.filename,
        width: 200, // 預設寬度，實際應用中可能需要從其他地方獲取
        height: 150, // 預設高度
        originalWidth: 200,
        originalHeight: 150,
      },
      zIndex: zIndexCounter++,
      draggable: true,
      selectable: true,
    };

    nodes.push(imageNode);
  });

  // 轉換範圍為對應的節點
  mapData.ranges.forEach((range) => {
    if (range.type === MapRangeType.RECTANGLE) {
      const rectRange = range as MapRectangleRange;
      const rectangleNode: Node = {
        id: rectRange.id,
        type: 'rectangleNode',
        position: {
          x: rectRange.x,
          y: rectRange.y,
        },
        data: {
          width: rectRange.width,
          height: rectRange.height,
          color: rectRange.color,
          label: rectRange.text || '',
        },
        zIndex: zIndexCounter++,
        draggable: true,
        selectable: true,
      };

      nodes.push(rectangleNode);
    } else if (range.type === MapRangeType.POLYGON) {
      const polyRange = range as MapPolygonRange;

      // 計算多邊形的中心點作為節點位置
      const centerX =
        polyRange.points.reduce((sum, point) => sum + point.x, 0) /
        polyRange.points.length;

      const centerY =
        polyRange.points.reduce((sum, point) => sum + point.y, 0) /
        polyRange.points.length;

      // 將絕對座標轉換為相對於中心點的座標
      const relativePoints = polyRange.points.map((point) => ({
        x: point.x - centerX,
        y: point.y - centerY,
      }));

      const pathNode: Node = {
        id: polyRange.id,
        type: 'pathNode',
        position: {
          x: centerX,
          y: centerY,
        },
        data: {
          points: relativePoints,
          color: polyRange.color,
          label: polyRange.text || '',
          strokeWidth: 2,
        },
        zIndex: zIndexCounter++,
        draggable: true,
        selectable: true,
      };

      nodes.push(pathNode);
    }
  });

  return nodes;
};

/**
 * 驗證 API 資料格式是否正確
 */
export const validateMapData = (data: unknown): data is Map => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, any>;

  // 檢查必要欄位
  if (!obj.id || typeof obj.id !== 'string') {
    console.error('Map data validation failed: missing or invalid id');

    return false;
  }

  if (!Array.isArray(obj.backgrounds)) {
    console.error('Map data validation failed: backgrounds must be an array');

    return false;
  }

  if (!Array.isArray(obj.ranges)) {
    console.error('Map data validation failed: ranges must be an array');

    return false;
  }

  // 驗證背景資料
  for (const bg of obj.backgrounds) {
    if (
      !bg.id ||
      !bg.filename ||
      typeof bg.x !== 'number' ||
      typeof bg.y !== 'number'
    ) {
      console.error('Map data validation failed: invalid background data', bg);

      return false;
    }
  }

  // 驗證範圍資料
  for (const range of obj.ranges) {
    if (!range.id || !range.type || !range.color) {
      console.error('Map data validation failed: invalid range data', range);

      return false;
    }

    if (range.type === MapRangeType.RECTANGLE) {
      if (
        typeof range.x !== 'number' ||
        typeof range.y !== 'number' ||
        typeof range.width !== 'number' ||
        typeof range.height !== 'number'
      ) {
        console.error(
          'Map data validation failed: invalid rectangle range data',
          range,
        );

        return false;
      }
    } else if (range.type === MapRangeType.POLYGON) {
      if (!Array.isArray(range.points) || range.points.length < 3) {
        console.error(
          'Map data validation failed: invalid polygon range data',
          range,
        );

        return false;
      }

      for (const point of range.points) {
        if (typeof point.x !== 'number' || typeof point.y !== 'number') {
          console.error(
            'Map data validation failed: invalid polygon point',
            point,
          );

          return false;
        }
      }
    }
  }

  return true;
};

/**
 * 使用範例：模擬從 API 載入資料
 */
export const loadMapDataFromApi = async (mapId: string): Promise<Node[]> => {
  try {
    // 模擬 API 呼叫
    console.log(`🌐 模擬載入地圖資料: ${mapId}`);

    // 在實際應用中，這裡會是真實的 API 呼叫
    // const response = await fetch(`/api/maps/${mapId}`);
    // const mapData = await response.json();

    // 目前使用 mock data 進行測試
    const { mockMapData } = await import('../../test/mockData');

    // 驗證資料格式
    if (!validateMapData(mockMapData)) {
      throw new Error('Invalid map data format');
    }

    // 轉換為 React Flow 節點（在測試環境中使用 mock 圖片生成器）
    const { generateMockImageUrl } = await import('../../test/mockImageUtils');
    const nodes = transformApiDataToNodes(mockMapData, generateMockImageUrl);

    console.log(`✅ 成功載入 ${nodes.length} 個節點`);
    console.log('📊 節點統計:', {
      imageNodes: nodes.filter((n) => n.type === 'imageNode').length,
      rectangleNodes: nodes.filter((n) => n.type === 'rectangleNode').length,
      pathNodes: nodes.filter((n) => n.type === 'pathNode').length,
    });

    return nodes;
  } catch (error) {
    console.error('❌ 載入地圖資料失敗:', error);
    throw error;
  }
};

/**
 * 輔助函數：計算多邊形的邊界框
 */
export const calculatePolygonBounds = (points: { x: number; y: number }[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} => {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

/**
 * 輔助函數：為節點計算合適的 zIndex
 */
export const calculateNodeZIndex = (
  nodes: Node[],
  nodeType: string,
): number => {
  const maxZIndex = Math.max(...nodes.map((n) => n.zIndex || 0), 0);

  // 背景圖片應該在最底層
  if (nodeType === 'imageNode') {
    const imageNodes = nodes.filter((n) => n.type === 'imageNode');

    return imageNodes.length;
  }

  // 其他節點在圖片之上
  return maxZIndex + 1;
};
