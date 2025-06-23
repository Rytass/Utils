import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import {
  ArticleBaseService,
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
      language: this.multiLanguage ? (language ?? DEFAULT_LANGUAGE) : undefined,
    }) as Promise<ArticleCollectionDto>;
  }

  @Query(() => ArticleBackstageDto)
  @IsPublic()
  backstageArticle(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ArticleBackstageDto> {
    return this.articleService.findById(id);
  }

  @Query(() => ArticleBackstageCollectionDto)
  @IsPublic()
  backstageArticles(
    @Args() args: ArticlesArgs,
  ): Promise<ArticleBackstageCollectionDto> {
    return this.articleService.findCollection(args);
  }
}
