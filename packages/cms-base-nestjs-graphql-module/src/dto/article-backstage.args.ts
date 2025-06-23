import { ArgsType, Field, registerEnumType } from '@nestjs/graphql';
import { ArticleStage } from '@rytass/cms-base-nestjs-module';
import { ArticlesArgs } from './articles.args';

@ArgsType()
export class ArticleBackstageArgs extends ArticlesArgs {
  @Field(() => ArticleStage)
  stage: ArticleStage;
}

registerEnumType(ArticleStage, {
  name: 'ArticleStage',
});
