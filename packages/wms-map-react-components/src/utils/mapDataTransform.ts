import { Node } from '@xyflow/react';
import {
  Map,
  MapBackground,
  MapRectangleRange,
  MapPolygonRange,
  MapRangeType,
  ID,
  WmsNodeClickInfo,
  ImageNodeClickInfo,
  RectangleNodeClickInfo,
  PathNodeClickInfo,
} from '../../typings';

/**
 * 轉換 React Flow 節點資料為 Map 資料格式
 */
export const transformNodesToMapData = (nodes: Node[]): Map => {
  const backgrounds: MapBackground[] = [];
  const ranges: (MapRectangleRange | MapPolygonRange)[] = [];

  nodes.forEach((node) => {
    switch (node.type) {
      case 'imageNode': {
        // ImageNode 轉換為 MapBackground
        const imageData = node.data as {
          fileName?: string;
          imageUrl: string;
          width?: number;
          height?: number;
        };

        const background: MapBackground = {
          id: node.id as ID,
          filename: imageData.fileName || 'unknown.jpg',
          x: node.position.x,
          y: node.position.y,
        };

        backgrounds.push(background);
        break;
      }

      case 'rectangleNode': {
        // RectangleNode 轉換為 MapRectangleRange
        const rectData = node.data as {
          width?: number;
          height?: number;
          color?: string;
          label?: string;
        };

        const rectangleRange: MapRectangleRange = {
          id: node.id as ID,
          type: MapRangeType.RECTANGLE,
          color: rectData.color || '#0000FF', // 預設為藍色
          x: node.position.x,
          y: node.position.y,
          width: rectData.width || 100,
          height: rectData.height || 100,
          text: rectData.label, // 將 React Flow 節點的 label 映射到 text 欄位
        };

        ranges.push(rectangleRange);
        break;
      }

      case 'pathNode': {
        // PathNode 轉換為 MapPolygonRange
        const pathData = node.data as {
          points: { x: number; y: number }[];
          color?: string;
          label?: string;
        };

        const polygonRange: MapPolygonRange = {
          id: node.id as ID,
          type: MapRangeType.POLYGON,
          color: pathData.color || '#0000FF', // 預設為藍色
          points: pathData.points || [],
          text: pathData.label, // 將 React Flow 節點的 label 映射到 text 欄位
        };

        ranges.push(polygonRange);
        break;
      }

      default:
        // 忽略未知的節點類型
        console.warn(`Unknown node type: ${node.type}`, node);
        break;
    }
  });

  // 生成 Map 物件
  const mapData: Map = {
    id: `map-${Date.now()}` as ID,
    backgrounds,
    ranges,
  };

  return mapData;
};

/**
 * 轉換 React Flow 節點為點擊資訊格式
 */
export const transformNodeToClickInfo = (
  node: Node,
): WmsNodeClickInfo | null => {
  const baseInfo = {
    id: node.id as ID,
    type: node.type!,
    position: node.position,
    zIndex: node.zIndex,
    selected: node.selected,
  };

  switch (node.type) {
    case 'imageNode': {
      const imageData = node.data as {
        fileName?: string;
        imageUrl: string;
        width?: number;
        height?: number;
        originalWidth?: number;
        originalHeight?: number;
      };

      const mapBackground: MapBackground = {
        id: node.id as ID,
        filename: imageData.fileName || 'unknown.jpg',
        x: node.position.x,
        y: node.position.y,
      };

      const clickInfo: ImageNodeClickInfo = {
        ...baseInfo,
        type: 'imageNode',
        imageData: {
          filename: imageData.fileName || 'unknown.jpg',
          size: {
            width: imageData.width || 0,
            height: imageData.height || 0,
          },
          originalSize: {
            width: imageData.originalWidth || 0,
            height: imageData.originalHeight || 0,
          },
          imageUrl: imageData.imageUrl,
        },
        mapBackground,
      };

      return clickInfo;
    }

    case 'rectangleNode': {
      const rectData = node.data as {
        width?: number;
        height?: number;
        color?: string;
        label?: string;
      };

      const mapRectangleRange: MapRectangleRange = {
        id: node.id as ID,
        type: MapRangeType.RECTANGLE,
        color: rectData.color || '#0000FF',
        x: node.position.x,
        y: node.position.y,
        width: rectData.width || 100,
        height: rectData.height || 100,
        text: rectData.label,
      };

      const clickInfo: RectangleNodeClickInfo = {
        ...baseInfo,
        type: 'rectangleNode',
        rectangleData: {
          color: rectData.color || '#0000FF',
          size: {
            width: rectData.width || 100,
            height: rectData.height || 100,
          },
          text: rectData.label,
        },
        mapRectangleRange,
      };

      return clickInfo;
    }

    case 'pathNode': {
      const pathData = node.data as {
        points: { x: number; y: number }[];
        color?: string;
        strokeWidth?: number;
        label?: string;
      };

      const bounds =
        pathData.points?.length > 0
          ? {
              minX: Math.min(...pathData.points.map((p) => p.x)),
              minY: Math.min(...pathData.points.map((p) => p.y)),
              maxX: Math.max(...pathData.points.map((p) => p.x)),
              maxY: Math.max(...pathData.points.map((p) => p.y)),
            }
          : null;

      const mapPolygonRange: MapPolygonRange = {
        id: node.id as ID,
        type: MapRangeType.POLYGON,
        color: pathData.color || '#0000FF',
        points: pathData.points || [],
        text: pathData.label,
      };

      const clickInfo: PathNodeClickInfo = {
        ...baseInfo,
        type: 'pathNode',
        pathData: {
          color: pathData.color || '#0000FF',
          strokeWidth: pathData.strokeWidth || 2,
          pointCount: pathData.points?.length || 0,
          points: pathData.points || [],
          bounds,
          text: pathData.label,
        },
        mapPolygonRange,
      };

      return clickInfo;
    }

    default:
      console.warn(`未知的節點類型: ${node.type}`);

      return null;
  }
};

/**
 * 格式化輸出單個節點的詳細資訊
 */
export const logNodeData = (node: Node): void => {
  console.group(`🎯 圖形點擊資訊 - ${node.type}`);

  console.log('📋 基本資訊:', {
    id: node.id,
    type: node.type,
    position: node.position,
    zIndex: node.zIndex,
    selected: node.selected,
  });

  switch (node.type) {
    case 'imageNode': {
      const imageData = node.data as {
        fileName?: string;
        imageUrl: string;
        width?: number;
        height?: number;
        originalWidth?: number;
        originalHeight?: number;
      };

      console.log('🖼️ 背景圖片資訊:', {
        filename: imageData.fileName || 'unknown.jpg',
        position: { x: node.position.x, y: node.position.y },
        size: {
          width: imageData.width,
          height: imageData.height,
        },
        originalSize: {
          width: imageData.originalWidth,
          height: imageData.originalHeight,
        },
        imageUrl: imageData.imageUrl?.slice(0, 50) + '...',
      });

      // 轉換格式（對應儲存時的格式）
      const background: MapBackground = {
        id: node.id as ID,
        filename: imageData.fileName || 'unknown.jpg',
        x: node.position.x,
        y: node.position.y,
      };

      console.log('💾 儲存格式 (MapBackground):', background);
      break;
    }

    case 'rectangleNode': {
      const rectData = node.data as {
        width?: number;
        height?: number;
        color?: string;
        label?: string;
      };

      console.log('📐 矩形資訊:', {
        color: rectData.color,
        position: { x: node.position.x, y: node.position.y },
        size: {
          width: rectData.width || 100,
          height: rectData.height || 100,
        },
        text: rectData.label,
      });

      // 轉換格式（對應儲存時的格式）
      const rectangleRange: MapRectangleRange = {
        id: node.id as ID,
        type: MapRangeType.RECTANGLE,
        color: rectData.color || '#0000FF',
        x: node.position.x,
        y: node.position.y,
        width: rectData.width || 100,
        height: rectData.height || 100,
        text: rectData.label,
      };

      console.log('💾 儲存格式 (MapRectangleRange):', rectangleRange);
      break;
    }

    case 'pathNode': {
      const pathData = node.data as {
        points: { x: number; y: number }[];
        color?: string;
        strokeWidth?: number;
        label?: string;
      };

      console.log('🔗 路徑資訊:', {
        color: pathData.color,
        strokeWidth: pathData.strokeWidth,
        pointCount: pathData.points?.length || 0,
        points: pathData.points,
        text: pathData.label,
        // 計算路徑邊界
        bounds:
          pathData.points?.length > 0
            ? {
                minX: Math.min(...pathData.points.map((p) => p.x)),
                minY: Math.min(...pathData.points.map((p) => p.y)),
                maxX: Math.max(...pathData.points.map((p) => p.x)),
                maxY: Math.max(...pathData.points.map((p) => p.y)),
              }
            : null,
      });

      // 轉換格式（對應儲存時的格式）
      const polygonRange: MapPolygonRange = {
        id: node.id as ID,
        type: MapRangeType.POLYGON,
        color: pathData.color || '#0000FF',
        points: pathData.points || [],
        text: pathData.label,
      };

      console.log('💾 儲存格式 (MapPolygonRange):', polygonRange);
      break;
    }

    default:
      console.warn(`未知的節點類型: ${node.type}`);
      break;
  }

  console.log('🔢 完整節點資料:', node);
  console.groupEnd();
};

/**
 * 格式化輸出 Map 資料到 console，包含詳細資訊
 */
export const logMapData = (mapData: Map): void => {
  console.group('🗺️ WMS Map Data Export');

  console.log('📋 Map Overview:', {
    id: mapData.id,
    backgroundCount: mapData.backgrounds.length,
    rangeCount: mapData.ranges.length,
  });

  if (mapData.backgrounds.length > 0) {
    console.group('🖼️ Background Images');
    mapData.backgrounds.forEach((bg, index) => {
      console.log(`Background ${index + 1}:`, {
        id: bg.id,
        filename: bg.filename,
        position: { x: bg.x, y: bg.y },
      });
    });

    console.groupEnd();
  }

  if (mapData.ranges.length > 0) {
    console.group('📐 Ranges');
    mapData.ranges.forEach((range, index) => {
      if (range.type === MapRangeType.RECTANGLE) {
        const rect = range as MapRectangleRange;

        console.log(`Rectangle ${index + 1}:`, {
          id: rect.id,
          type: rect.type,
          color: rect.color,
          position: { x: rect.x, y: rect.y },
          size: { width: rect.width, height: rect.height },
          text: rect.text,
        });
      } else if (range.type === MapRangeType.POLYGON) {
        const poly = range as MapPolygonRange;

        console.log(`Polygon ${index + 1}:`, {
          id: poly.id,
          type: poly.type,
          color: poly.color,
          pointCount: poly.points.length,
          points: poly.points,
          text: poly.text,
        });
      }
    });

    console.groupEnd();
  }

  console.log('📄 Complete Map Data:', mapData);
  console.groupEnd();
};
