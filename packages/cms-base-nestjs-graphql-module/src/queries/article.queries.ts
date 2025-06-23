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
import { ArticleBackstageDto } from '../dto/article-backstage.dto';
import { ArticleBackstageCollectionDto } from '../dto/article-backstage-collection.dto';
import { Inject } from '@nestjs/common';
import { ArticleBackstageArgs } from '../dto/article-backstage.args';

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

  @Query(() => ArticleBackstageDto)
  @IsPublic()
  backstageArticle(
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int, nullable: true })
    version?: number | null,
  ): Promise<ArticleBackstageDto> {
    return this.articleService.findById(id, { version });
  }

  @Query(() => ArticleBackstageCollectionDto)
  @IsPublic()
  backstageArticles(
    @Args() args: ArticleBackstageArgs,
  ): Promise<ArticleBackstageCollectionDto> {
    return this.articleService.findCollection(args);
  }
}
