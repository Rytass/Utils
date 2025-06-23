import { Field, ID, InterfaceType } from '@nestjs/graphql';

@InterfaceType('BaseArticle')
export class BaseArticleDto {
  @Field(() => ID)
  id: string;

  @Field(() => [String])
  tags: string[];

  @Field(() => Date)
  createdAt: Date;
}
