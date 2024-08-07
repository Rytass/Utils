import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { CMSBaseModelsModule } from './models/models.module';
import { ArticleBaseService } from './services/article-base.service';
import { CategoryBaseService } from './services/category-base.service';
import {
  ResolvedRepoProviders,
  TARGETS,
} from './constant/resolved-repo-providers';
import { CategoryDataLoader } from './data-loaders/category.dataloader';
import {
  CATEGORY_DATA_LOADER,
  CMS_BASE_MODULE_OPTIONS,
} from './typings/cms-base-providers';
import { CMSBaseModuleAsyncOptionsDto } from './typings/cms-base-root-module-async-options';
import { OptionProviders } from './constant/option-providers';
import { CMSBaseModuleOptionsDto } from './typings/cms-base-root-module-options.dto';
import { CMSBaseModuleOptionFactory } from './typings/cms-base-root-module-option-factory';

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
        CategoryBaseService,
      ],
      exports: [
        ...TARGETS.map(([, , resolved]) => resolved),
        ArticleBaseService,
        CategoryBaseService,
        CategoryDataLoader,
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
      ],
      exports: [
        ...TARGETS.map(([, , resolved]) => resolved),
        ArticleBaseService,
        CategoryBaseService,
        CategoryDataLoader,
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
