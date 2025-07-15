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
  color: MapRangeColor;
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
}

export interface MapPolygonRangePoint {
  x: number;
  y: number;
}

export interface MapPolygonRange extends MapRange {
  type: MapRangeType.POLYGON;
  points: MapPolygonRangePoint[];
}
