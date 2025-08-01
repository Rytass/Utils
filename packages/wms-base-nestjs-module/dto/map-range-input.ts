import { Injectable } from '@nestjs/common';
import { Field, Float, ID } from '@nestjs/graphql';
import {
  MapRangeColor,
  MapRangeType,
} from 'wms-base-nestjs-module/src/typings/warehouse-map.enum';
import { MapPolygonRangePointInput } from './map-polygon-range-point.input';

@Injectable()
export class MapRangeInput {
  @Field(() => ID)
  id: string;
  @Field(() => MapRangeType)
  type: MapRangeType;
  @Field(() => MapRangeColor)
  color: MapRangeColor;
  @Field(() => Float)
  x?: number;
  @Field(() => Float)
  y?: number;
  @Field(() => Float)
  width?: number;
  @Field(() => Float)
  height?: number;
  @Field(() => [MapPolygonRangePointInput])
  points?: MapPolygonRangePointInput[];
}
