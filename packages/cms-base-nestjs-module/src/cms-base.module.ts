import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { CMSBaseModelsModule } from './models/models.module';
import { ArticleBaseService } from './services/article-base.service';
import { CategoryBaseService } from './services/category-base.service';
import {
  ResolvedRepoProviders,
  TARGETS,
} from './constants/resolved-repo-providers';
import { CategoryDataLoader } from './data-loaders/category.dataloader';
import {
  ARTICLE_BASE_SERVICE,
  ARTICLE_SIGNATURE_DATALOADER,
  AUTO_RELEASE_AFTER_APPROVED,
  CATEGORY_DATA_LOADER,
  CIRCULAR_CATEGORY_MODE,
  CMS_BASE_MODULE_OPTIONS,
  DRAFT_MODE,
  FULL_TEXT_SEARCH_MODE,
  MULTIPLE_CATEGORY_PARENT_MODE,
  MULTIPLE_LANGUAGE_MODE,
  SIGNATURE_LEVELS,
} from './typings/cms-base-providers';
import { CMSBaseModuleAsyncOptionsDto } from './typings/cms-base-root-module-async-options.dto';
import { OptionProviders } from './constants/option-providers';
import { CMSBaseModuleOptionsDto } from './typings/cms-base-root-module-options.dto';
import { CMSBaseModuleOptionFactory } from './typings/cms-base-root-module-option-factory';
import { ArticleSignatureDataLoader } from './data-loaders/article-signature.dataloader';

@Global()
@Module({})
export class CMSBaseModule {
  static forRootAsync(options: CMSBaseModuleAsyncOptionsDto): DynamicModule {
    return {
      module: CMSBaseModule,
      imports: [...(options?.imports ?? []), CMSBaseModelsModule],
      providers: [
        ...this.createAsyncProvider(options),
        ...OptionProviders,
        ...ResolvedRepoProviders,
        CategoryDataLoader,
        {
          provide: CATEGORY_DATA_LOADER,
          useExisting: CategoryDataLoader,
        },
        ArticleBaseService,
        {
          provide: ARTICLE_BASE_SERVICE,
          useExisting: ArticleBaseService,
        },
        CategoryBaseService,
        ArticleSignatureDataLoader,
        {
          provide: ARTICLE_SIGNATURE_DATALOADER,
          useExisting: ArticleSignatureDataLoader,
        },
      ],
      exports: [
        ...TARGETS.map(([, , resolved]) => resolved),
        ArticleBaseService,
        CategoryBaseService,
        CategoryDataLoader,
        ArticleSignatureDataLoader,
        MULTIPLE_LANGUAGE_MODE,
        DRAFT_MODE,
        MULTIPLE_CATEGORY_PARENT_MODE,
        CIRCULAR_CATEGORY_MODE,
        FULL_TEXT_SEARCH_MODE,
        SIGNATURE_LEVELS,
        AUTO_RELEASE_AFTER_APPROVED,
      ],
    };
  }

  static forRoot(options?: CMSBaseModuleOptionsDto): DynamicModule {
    return {
      module: CMSBaseModule,
      imports: [CMSBaseModelsModule],
      providers: [
        {
          provide: CMS_BASE_MODULE_OPTIONS,
          useValue: options,
        },
        ...OptionProviders,
        ...ResolvedRepoProviders,
        CategoryDataLoader,
        {
          provide: CATEGORY_DATA_LOADER,
          useExisting: CategoryDataLoader,
        },
        ArticleBaseService,
        {
          provide: ARTICLE_BASE_SERVICE,
          useExisting: ArticleBaseService,
        },
        CategoryBaseService,
        ArticleSignatureDataLoader,
        {
          provide: ARTICLE_SIGNATURE_DATALOADER,
          useExisting: ArticleSignatureDataLoader,
        },
      ],
      exports: [
        ...TARGETS.map(([, , resolved]) => resolved),
        ArticleBaseService,
        CategoryBaseService,
        CategoryDataLoader,
        ArticleSignatureDataLoader,
        MULTIPLE_LANGUAGE_MODE,
        DRAFT_MODE,
        MULTIPLE_CATEGORY_PARENT_MODE,
        CIRCULAR_CATEGORY_MODE,
        FULL_TEXT_SEARCH_MODE,
        SIGNATURE_LEVELS,
        AUTO_RELEASE_AFTER_APPROVED,
      ],
    };
  }

  private static createAsyncProvider(
    options: CMSBaseModuleAsyncOptionsDto,
  ): Provider[] {
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

  private static createAsyncOptionsProvider(
    options: CMSBaseModuleAsyncOptionsDto,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: CMS_BASE_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: CMS_BASE_MODULE_OPTIONS,
      useFactory: async (optionsFactory: CMSBaseModuleOptionFactory) =>
        await optionsFactory.createCMSOptions(),
      inject: [
        (options.useExisting ||
          options.useClass) as Type<CMSBaseModuleOptionFactory>,
      ],
    };
  }
}
