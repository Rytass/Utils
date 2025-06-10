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
  ARTICLE_SIGNATURE_SERVICE,
  CATEGORY_DATA_LOADER,
  CMS_BASE_MODULE_OPTIONS,
} from './typings/cms-base-providers';
import { CMSBaseModuleAsyncOptionsDto } from './typings/cms-base-root-module-async-options';
import { OptionProviders } from './constants/option-providers';
import { CMSBaseModuleOptionsDto } from './typings/cms-base-root-module-options.dto';
import { CMSBaseModuleOptionFactory } from './typings/cms-base-root-module-option-factory';
import { ArticleSignatureService } from './services/article-signature.service';
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
        ArticleSignatureService,
        {
          provide: ARTICLE_SIGNATURE_SERVICE,
          useExisting: ArticleSignatureService,
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
        ArticleSignatureService,
        CategoryDataLoader,
        ArticleSignatureDataLoader,
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
        ArticleSignatureService,
        {
          provide: ARTICLE_SIGNATURE_SERVICE,
          useExisting: ArticleSignatureService,
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
        ArticleSignatureService,
        CategoryDataLoader,
        ArticleSignatureDataLoader,
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
