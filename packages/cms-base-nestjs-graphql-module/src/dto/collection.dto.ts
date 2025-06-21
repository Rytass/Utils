import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('Collection')
export class Collection {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  offset!: number;

  @Field(() => Int)
  limit!: number;
}
