import { Module, DynamicModule } from '@nestjs/common';
import { CategoryDataLoader, CMSBaseModule } from 'cms-base-nestjs-module/lib';
import { CMSBaseModuleOptionsDto } from 'cms-base-nestjs-module/lib/typings/cms-base-root-module-options.dto';
import { CMSBaseModuleAsyncOptionsDto } from 'cms-base-nestjs-module/src/typings/cms-base-root-module-async-options';
import { ArticleStageDataLoader } from './data-loaders/article-stage.dataloader';
import { ArticleDataLoader } from './data-loaders/article.dataloader';
import { MemberDataLoader } from './data-loaders/members.dataloader';
import { ArticleMutations } from './mutations/article.mutations';
import { AuthMutations } from './mutations/auth.mutations';
import { CategoryMutations } from './mutations/category.mutations';
import { ArticleQueries } from './queries/article.queries';
import { CategoryQueries } from './queries/category.queries';
import { ArticleSignatureResolvers } from './resolvers/article-signature.resolvers';
import { ArticleVersionContentResolvers } from './resolvers/article-version-content.resolvers';
import {
  ArticleResolvers,
  BackstageArticleResolvers,
} from './resolvers/article.resolvers';
import {
  CategoryResolvers,
  BackstageCategoryResolvers,
} from './resolvers/category.resolvers';

@Module({})
export class CmsBaseGraphQLModule {
  static forRootAsync(options: CMSBaseModuleAsyncOptionsDto): DynamicModule {
    return {
      module: CmsBaseGraphQLModule,
      imports: [
        ...(options.imports || []),
        CMSBaseModule.forRootAsync(options),
      ],
      exports: [CMSBaseModule],
      providers: [
        CategoryQueries,
        CategoryMutations,
        CategoryResolvers,
        BackstageCategoryResolvers,
        CategoryDataLoader,
        ArticleQueries,
        ArticleMutations,
        ArticleResolvers,
        BackstageArticleResolvers,
        ArticleSignatureResolvers,
        ArticleVersionContentResolvers,
        ArticleDataLoader,
        ArticleStageDataLoader,
        MemberDataLoader,
        AuthMutations,
      ],
    };
  }

  static forRoot(options?: CMSBaseModuleOptionsDto): DynamicModule {
    return {
      module: CmsBaseGraphQLModule,
      imports: [CMSBaseModule.forRoot(options)],
      exports: [CMSBaseModule],
      providers: [
        CategoryQueries,
        CategoryMutations,
        CategoryResolvers,
        BackstageCategoryResolvers,
        CategoryDataLoader,
        ArticleQueries,
        ArticleMutations,
        ArticleResolvers,
        BackstageArticleResolvers,
        ArticleSignatureResolvers,
        ArticleVersionContentResolvers,
        ArticleDataLoader,
        ArticleStageDataLoader,
        MemberDataLoader,
        AuthMutations,
      ],
    };
  }
}
