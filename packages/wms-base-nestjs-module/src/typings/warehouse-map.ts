import { MapRangeColor, MapRangeType } from './warehouse-map.enum';

export type MapData = {
  id: string;
  backgrounds: MapBackground[];
  ranges: MapRange[];
};

export type MapBackground = {
  id: string;
  filename: string;
  x: number;
  y: number;
  height: number;
  width: number;
};

export interface MapRange {
  id: string;
  type: MapRangeType;
  color: MapRangeColor;
}

export interface MapRectangleRange extends MapRange {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapPolygonRange extends MapRange {
  points: MapPolygonRangePoint[];
}

export interface MapPolygonRangePoint {
  x: number;
  y: number;
}

export type Location = {
  map: MapData;
};
