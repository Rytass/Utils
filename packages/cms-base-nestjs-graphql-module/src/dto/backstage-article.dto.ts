import { Field, Int, ObjectType } from '@nestjs/graphql';
import { BaseArticleDto } from './base-article.dto';

@ObjectType('BackstageArticle')
export class BackstageArticleDto extends BaseArticleDto {
  @Field(() => Int)
  version: number;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  submittedAt?: Date | null;
}
