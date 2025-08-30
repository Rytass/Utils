import { Field, Float, ID, InputType } from '@nestjs/graphql';

@InputType()
export class MapBackgroundInput {
  @Field(() => ID)
  id: string;
  @Field()
  filename: string;
  @Field(() => Float)
  x: number;
  @Field(() => Float)
  y: number;
  @Field(() => Float)
  height: number;
  @Field(() => Float)
  width: number;
}
