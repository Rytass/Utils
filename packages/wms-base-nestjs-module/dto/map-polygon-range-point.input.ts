import { Injectable } from '@nestjs/common';
import { Field, Float } from '@nestjs/graphql';

@Injectable()
export class MapPolygonRangePointInput {
  @Field(() => Float)
  x: number;
  @Field(() => Float)
  y: number;
}
