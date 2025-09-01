export type ID = string;

export enum MapRangeColor {
  RED = 'RED',
  YELLOW = 'YELLOW',
  GREEN = 'GREEN',
  BLUE = 'BLUE',
  BLACK = 'BLACK',
}

export enum MapRangeType {
  RECTANGLE = 'RECTANGLE',
  POLYGON = 'POLYGON',
}

interface MapRange {
  id: ID;
  type: MapRangeType;
  color: string;
}

export interface MapBackground {
  id: ID;
  filename: string;
  x: number;
  y: number;
}

export interface Map {
  id: ID;
  backgrounds: MapBackground[];
  ranges: MapRange[];
}

export interface MapRectangleRange extends MapRange {
  type: MapRangeType.RECTANGLE;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
}

export interface MapPolygonRangePoint {
  x: number;
  y: number;
}

export interface MapPolygonRange extends MapRange {
  type: MapRangeType.POLYGON;
  points: MapPolygonRangePoint[];
  text?: string;
}

export enum EditMode {
  BACKGROUND = 'BACKGROUND',
  LAYER = 'LAYER',
}

export enum DrawingMode {
  NONE = 'NONE',
  RECTANGLE = 'RECTANGLE',
  PEN = 'PEN',
}

export enum LayerDrawingTool {
  SELECT = 'SELECT',
  RECTANGLE = 'RECTANGLE',
  PEN = 'PEN',
}

export enum ViewMode {
  EDIT = 'EDIT',
  VIEW = 'VIEW',
}

/**
 * 圖形點擊資訊基礎介面
 */
export interface NodeClickInfo {
  id: ID;
  type: string;
  position: { x: number; y: number };
  zIndex?: number;
  selected?: boolean;
}

/**
 * 背景圖片點擊資訊
 */
export interface ImageNodeClickInfo extends NodeClickInfo {
  type: 'imageNode';
  imageData: {
    filename: string;
    size: { width: number; height: number };
    originalSize: { width: number; height: number };
    imageUrl: string;
  };
  mapBackground: MapBackground;
}

/**
 * 矩形圖形點擊資訊
 */
export interface RectangleNodeClickInfo extends NodeClickInfo {
  type: 'rectangleNode';
  rectangleData: {
    color: string;
    size: { width: number; height: number };
    text?: string;
  };
  mapRectangleRange: MapRectangleRange;
}

/**
 * 路徑圖形點擊資訊
 */
export interface PathNodeClickInfo extends NodeClickInfo {
  type: 'pathNode';
  pathData: {
    color: string;
    strokeWidth: number;
    pointCount: number;
    points: { x: number; y: number }[];
    bounds: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    } | null;
    text?: string;
  };
  mapPolygonRange: MapPolygonRange;
}

/**
 * 所有圖形點擊資訊的聯合類型
 */
export type WMSNodeClickInfo =
  | ImageNodeClickInfo
  | RectangleNodeClickInfo
  | PathNodeClickInfo;
