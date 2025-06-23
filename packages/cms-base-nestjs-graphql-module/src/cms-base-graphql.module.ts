import { Module, DynamicModule } from '@nestjs/common';
import {
  CMSBaseModule,
  CMSBaseModuleOptionsDto,
  CMSBaseModuleAsyncOptionsDto,
} from '@rytass/cms-base-nestjs-module';
import { ArticleMutations } from './mutations/article.mutations';
import { CategoryMutations } from './mutations/category.mutations';
import { ArticleQueries } from './queries/article.queries';
import { CategoryQueries } from './queries/category.queries';
import { MemberDataLoader } from './dataloaders/members.dataloader';
import { ArticleDataLoader } from './dataloaders/article.dataloader';
import { ArticleResolver } from './resolvers/article.resolver';
import { BackstageArticleResolver } from './resolvers/backstage-article.resolver';

@Module({})
export class CMSBaseGraphQLModule {
  static forRootAsync(options: CMSBaseModuleAsyncOptionsDto): DynamicModule {
    return {
      module: CMSBaseGraphQLModule,
      imports: [
        ...(options.imports || []),
        CMSBaseModule.forRootAsync(options),
      ],
      exports: [CMSBaseModule],
      providers: [
        MemberDataLoader,
        ArticleDataLoader,
        ArticleResolver,
        BackstageArticleResolver,
        ArticleQueries,
        ArticleMutations,
        CategoryQueries,
        CategoryMutations,
      ],
    };
  }

  static forRoot(options?: CMSBaseModuleOptionsDto): DynamicModule {
    return {
      module: CMSBaseGraphQLModule,
      imports: [CMSBaseModule.forRoot(options)],
      exports: [CMSBaseModule],
      providers: [
        MemberDataLoader,
        ArticleDataLoader,
        ArticleResolver,
        BackstageArticleResolver,
        ArticleQueries,
        ArticleMutations,
        CategoryQueries,
        CategoryMutations,
      ],
    };
  }
}
