import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { MapRangeColor, MapRangeType } from '../typings/warehouse-map.enum';
import { MapPolygonRangePointInput } from './map-polygon-range-point.input';

@InputType()
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
