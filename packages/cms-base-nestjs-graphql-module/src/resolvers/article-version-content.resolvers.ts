import { ResolveField, Resolver, Root } from '@nestjs/graphql';

import { Logger } from '@nestjs/common';
import { ArticleVersionContent } from '../dto/article.dto';
import { CategoryDataLoader } from '../data-loaders/category.dataloader';
import { ArticleDataLoader } from '../data-loaders/article.dataloader';
import { BaseArticleVersionContentEntity } from '@rytass/cms-base-nestjs-module';

@Resolver(() => ArticleVersionContent)
export class ArticleVersionContentResolvers {
  constructor(
    private readonly categoryDataLoader: CategoryDataLoader,
    private readonly articleDataLoader: ArticleDataLoader,
  ) {}

  Logger = new Logger(ArticleVersionContentResolvers.name);

  @ResolveField(() => String)
  id(@Root() versionContent: BaseArticleVersionContentEntity): string {
    return `${versionContent.articleId}-${versionContent.language}-${versionContent.version}`;
  }
}
