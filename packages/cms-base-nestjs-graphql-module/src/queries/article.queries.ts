import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import {
  ArticleBaseService,
  DEFAULT_LANGUAGE,
  SingleArticleBaseDto,
} from '@rytass/cms-base-nestjs-module';
import { ArticlesArgs } from '../dto/articles.args';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { Language } from '../decorators/language.decorator';
import { ArticleCollectionDto } from '../dto/article-collection.dto';
import { BaseArticleDto } from '../dto/base-article.dto';

@Resolver()
export class ArticleQueries {
  constructor(private readonly articleService: ArticleBaseService) {}

  @Query(() => BaseArticleDto)
  @IsPublic()
  article(
    @Args('id', { type: () => ID }) id: string,
    @Language() language: string = DEFAULT_LANGUAGE,
  ): Promise<BaseArticleDto> {
    return this.articleService.findById(id, {
      language: language ?? DEFAULT_LANGUAGE,
    }) as Promise<SingleArticleBaseDto>;
  }

  @Query(() => ArticleCollectionDto)
  @IsPublic()
  async articles(@Args() args: ArticlesArgs): Promise<ArticleCollectionDto> {
    return this.articleService.findCollection(args);
  }
}
