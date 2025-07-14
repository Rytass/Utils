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
import { MemberDataLoader } from './data-loaders/members.dataloader';
import { ArticleDataLoader } from './data-loaders/article.dataloader';
import { ArticleResolver } from './resolvers/article.resolver';
import { BackstageArticleResolver } from './resolvers/backstage-article.resolver';
import { ArticleSignatureResolver } from './resolvers/article-signature.resolver';
import { BackstageCategoryResolver } from './resolvers/backstage-category.resolver';

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
        ArticleSignatureResolver,
        ArticleQueries,
        ArticleMutations,
        CategoryQueries,
        CategoryMutations,
        BackstageCategoryResolver,
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
        ArticleSignatureResolver,
        ArticleQueries,
        ArticleMutations,
        CategoryQueries,
        CategoryMutations,
        BackstageCategoryResolver,
      ],
    };
  }
}
