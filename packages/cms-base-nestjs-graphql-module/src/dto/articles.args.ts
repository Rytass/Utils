import { ArgsType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { ArticleStage } from '@rytass/cms-base-nestjs-module';

@ArgsType()
export class ArticlesArgs {
  @Field(() => ArticleStage, { nullable: true })
  stage?: ArticleStage | null;

  @Field(() => [String], { nullable: true })
  categoryIds?: string[] | null;

  @Field(() => Int, { nullable: true })
  offset?: number | null;

  @Field(() => Int, { nullable: true })
  limit?: number | null;

  @Field(() => String, { nullable: true })
  searchTerm?: string | null;
}

registerEnumType(ArticleStage, {
  name: 'ArticleStage',
});
