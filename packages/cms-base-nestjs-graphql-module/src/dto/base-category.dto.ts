import { Field, ID } from '@nestjs/graphql';

export class BaseCategoryDto {
  @Field(() => ID)
  id: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}
