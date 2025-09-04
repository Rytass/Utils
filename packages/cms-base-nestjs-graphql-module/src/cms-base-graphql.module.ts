import { Module, DynamicModule, Provider, Type } from '@nestjs/common';
import { CMSBaseModule } from '@rytass/cms-base-nestjs-module';
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
import { CMSGraphqlBaseModuleOptionsDto } from './typings/cms-graphql-base-root-module-options.dto';
import { CMSGraphqlBaseModuleAsyncOptionsDto } from './typings/cms-graphql-base-root-module-async-options.dto';
import { OptionProviders } from './constants/option-providers';
import { CMS_BASE_GRAPHQL_MODULE_OPTIONS } from './typings/cms-graphql-base-providers';
import { CMSGraphqlBaseModuleOptionFactory } from './typings/cms-graphql-base-root-module-option-factory';

@Module({})
export class CMSBaseGraphQLModule {
  static forRootAsync(options: CMSGraphqlBaseModuleAsyncOptionsDto): DynamicModule {
    return {
      module: CMSBaseGraphQLModule,
      imports: [...(options.imports || []), CMSBaseModule.forRootAsync(options)],
      exports: [CMSBaseModule],
      providers: [
        ...this.createAsyncProvider(options),
        ...OptionProviders,
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

  static forRoot(options: CMSGraphqlBaseModuleOptionsDto): DynamicModule {
    return {
      module: CMSBaseGraphQLModule,
      imports: [CMSBaseModule.forRoot(options)],
      exports: [CMSBaseModule],
      providers: [
        {
          provide: CMS_BASE_GRAPHQL_MODULE_OPTIONS,
          useValue: options,
        },
        ...OptionProviders,
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

  private static createAsyncProvider(options: CMSGraphqlBaseModuleAsyncOptionsDto): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    return [
      this.createAsyncOptionsProvider(options),
      ...(options.useClass
        ? [
            {
              provide: options.useClass,
              useClass: options.useClass,
            },
          ]
        : []),
    ];
  }

  private static createAsyncOptionsProvider(options: CMSGraphqlBaseModuleAsyncOptionsDto): Provider {
    if (options.useFactory) {
      return {
        provide: CMS_BASE_GRAPHQL_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: CMS_BASE_GRAPHQL_MODULE_OPTIONS,
      useFactory: async (optionsFactory: CMSGraphqlBaseModuleOptionFactory) => await optionsFactory.createCMSOptions(),
      inject: [(options.useExisting || options.useClass) as Type<CMSGraphqlBaseModuleOptionFactory>],
    };
  }
}
