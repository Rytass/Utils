import { CMSBaseRootModuleOptionsDto } from './typings/cms-base-root-module-options.dto';
import { CMSBaseModule } from './cms-base.module';
import { CMSBaseRootModuleAsyncOptionsDto } from './typings/cms-base-root-module-async-options';
import { OptionProviders } from './constant/option-providers';
import { DynamicModule, Provider, Type } from '@nestjs/common';
import { CMS_BASE_MODULE_OPTIONS } from './typings/cms-base-providers';
import { CMSBaseRootModuleOptionFactory } from './typings/cms-base-root-module-option-factory';

export class CMSBaseRootModule {
  static forRootAsync(
    options: CMSBaseRootModuleAsyncOptionsDto,
  ): DynamicModule {
    return {
      module: CMSBaseModule,
      imports: options?.imports ?? [],
      providers: [...this.createAsyncProvider(options), ...OptionProviders],
    };
  }

  static forRoot(options?: CMSBaseRootModuleOptionsDto): DynamicModule {
    return {
      module: CMSBaseModule,
      providers: [
        {
          provide: CMS_BASE_MODULE_OPTIONS,
          useValue: options,
        },
        ...OptionProviders,
      ],
    };
  }

  private static createAsyncProvider(
    options: CMSBaseRootModuleAsyncOptionsDto,
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
    options: CMSBaseRootModuleAsyncOptionsDto,
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
      useFactory: async (optionsFactory: CMSBaseRootModuleOptionFactory) =>
        await optionsFactory.createCMSOptions(),
      inject: [
        (options.useExisting ||
          options.useClass) as Type<CMSBaseRootModuleOptionFactory>,
      ],
    };
  }
}
