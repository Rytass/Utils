import { ArgsType, Field, registerEnumType } from '@nestjs/graphql';
import { ArticleSorter, ArticleStage } from '@rytass/cms-base-nestjs-module';
import { ArticlesArgs } from './articles.args';

@ArgsType()
export class BackstageArticleArgs extends ArticlesArgs {
  @Field(() => ArticleStage)
  stage: ArticleStage;

  @Field(() => ArticleSorter, { nullable: true })
  sorter?: ArticleSorter | null;
}

registerEnumType(ArticleStage, {
  name: 'ArticleStage',
});

registerEnumType(ArticleSorter, {
  name: 'ArticleSorter',
});
