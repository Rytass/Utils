import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { ArticleBaseService } from '@rytass/cms-base-nestjs-module';
import {
  Article,
  ArticleCollection,
  BackstageArticle,
  BackstageArticleCollection,
} from '../dto/article.dto';
import { ArticlesArgs } from '../dto/articles.args';
import { IsPublic } from '@rytass/member-base-nestjs-module';

@Resolver()
export class ArticleQueries {
  constructor(private readonly articleService: ArticleBaseService) {}

  @Query(() => Article)
  @IsPublic()
  async article(
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int, nullable: true })
    version?: number | null,
  ): Promise<Article> {
    return this.articleService.findById(id, { version });
  }

  @Query(() => ArticleCollection)
  @IsPublic()
  async articles(@Args() args: ArticlesArgs): Promise<ArticleCollection> {
    return this.articleService.findCollection(args);
  }

  @Query(() => BackstageArticle)
  @IsPublic()
  async backstageArticle(
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int, nullable: true })
    version?: number | null,
  ): Promise<BackstageArticle> {
    return this.articleService.findById(id, { version });
  }

  @Query(() => BackstageArticleCollection)
  @IsPublic()
  async backstageArticles(
    @Args() args: ArticlesArgs,
  ): Promise<BackstageArticleCollection> {
    return this.articleService.findCollection(args);
  }
}
