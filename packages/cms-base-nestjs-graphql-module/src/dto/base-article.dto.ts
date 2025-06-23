import { Field, ID } from '@nestjs/graphql';

export class BaseArticleDto {
  @Field(() => ID)
  id: string;

  @Field(() => [String])
  tags: string[];

  @Field(() => Date)
  createdAt: Date;
}
