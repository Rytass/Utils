import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class MapPolygonRangePointInput {
  @Field(() => Float)
  x: number;
  @Field(() => Float)
  y: number;
}
