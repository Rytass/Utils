import { Field, ID, ObjectType } from '@nestjs/graphql';
import { BackstageArticleDto } from './backstage-article.dto';

@ObjectType('ArticleStageVersion')
export class ArticleStageVersionDto {
  @Field(() => ID)
  id: string;

  @Field(() => BackstageArticleDto, { nullable: true })
  draft: BackstageArticleDto | null;

  @Field(() => BackstageArticleDto, { nullable: true })
  reviewing: BackstageArticleDto | null;

  @Field(() => BackstageArticleDto, { nullable: true })
  verified: BackstageArticleDto | null;

  @Field(() => BackstageArticleDto, { nullable: true })
  scheduled: BackstageArticleDto | null;

  @Field(() => BackstageArticleDto, { nullable: true })
  released: BackstageArticleDto | null;
}
