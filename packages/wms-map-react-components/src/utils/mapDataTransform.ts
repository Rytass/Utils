import { Node } from '@xyflow/react';
import { 
  Map, 
  MapBackground, 
  MapRectangleRange, 
  MapPolygonRange, 
  MapRangeType,
  ID
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
        });
      } else if (range.type === MapRangeType.POLYGON) {
        const poly = range as MapPolygonRange;
        console.log(`Polygon ${index + 1}:`, {
          id: poly.id,
          type: poly.type,
          color: poly.color,
          pointCount: poly.points.length,
          points: poly.points,
        });
      }
    });
    console.groupEnd();
  }
  
  console.log('📄 Complete Map Data:', mapData);
  console.groupEnd();
};