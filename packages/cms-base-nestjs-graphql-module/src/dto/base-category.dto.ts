import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('BaseCategory')
export class BaseCategoryDto {
  @Field(() => ID)
  id: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}
