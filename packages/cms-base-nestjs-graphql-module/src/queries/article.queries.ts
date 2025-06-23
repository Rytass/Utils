import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import {
  ArticleBaseService,
  ArticleStage,
  DEFAULT_LANGUAGE,
  MULTIPLE_LANGUAGE_MODE,
  SingleArticleBaseDto,
} from '@rytass/cms-base-nestjs-module';
import { ArticlesArgs } from '../dto/articles.args';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { Language } from '../decorators/language.decorator';
import { ArticleCollectionDto } from '../dto/article-collection.dto';
import { ArticleDto } from '../dto/article.dto';
import { BackstageArticleDto } from '../dto/backstage-article.dto';
import { BackstageArticleCollectionDto } from '../dto/backstage-article-collection.dto';
import { Inject } from '@nestjs/common';
import { BackstageArticleArgs } from '../dto/backstage-article.args';

@Resolver()
export class ArticleQueries {
  constructor(
    private readonly articleService: ArticleBaseService,
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multiLanguage: boolean,
  ) {}

  @Query(() => ArticleDto)
  @IsPublic()
  article(
    @Args('id', { type: () => ID }) id: string,
    @Language() language: string = DEFAULT_LANGUAGE,
  ): Promise<ArticleDto> {
    return this.articleService.findById(id, {
      stage: ArticleStage.RELEASED,
      language: this.multiLanguage ? (language ?? DEFAULT_LANGUAGE) : undefined,
    }) as Promise<SingleArticleBaseDto>;
  }

  @Query(() => ArticleCollectionDto)
  @IsPublic()
  async articles(
    @Args() args: ArticlesArgs,
    @Language() language: string = DEFAULT_LANGUAGE,
  ): Promise<ArticleCollectionDto> {
    return this.articleService.findCollection({
      ...args,
      stage: ArticleStage.RELEASED,
      language: this.multiLanguage ? (language ?? DEFAULT_LANGUAGE) : undefined,
    }) as Promise<ArticleCollectionDto>;
  }

  @Query(() => BackstageArticleDto)
  @IsPublic()
  backstageArticle(
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int, nullable: true })
    version?: number | null,
  ): Promise<BackstageArticleDto> {
    return this.articleService.findById(id, { version });
  }

  @Query(() => BackstageArticleCollectionDto)
  @IsPublic()
  backstageArticles(
    @Args() args: BackstageArticleArgs,
  ): Promise<BackstageArticleCollectionDto> {
    return this.articleService.findCollection(args);
  }
}
