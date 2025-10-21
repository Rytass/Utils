import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import {
  StorageBaseModuleAsyncOptions,
  StorageBaseModuleOptions,
  StorageBaseModuleOptionsFactory,
} from './typings/storage-base-module-options.interface';
import { STORAGE_MODULE_OPTIONS } from './typings/storages-base-module-providers';
import { StorageService } from './services/storage.service';

@Module({})
export class StorageBaseModule {
  static forRoot(options: StorageBaseModuleOptions): DynamicModule {
    return {
      module: StorageBaseModule,
      providers: [
        {
          provide: STORAGE_MODULE_OPTIONS,
          useValue: options,
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
  static forRootAsync(options: StorageBaseModuleAsyncOptions): DynamicModule {
    return {
      module: StorageBaseModule,
      imports: [...(options?.imports ?? [])],
      providers: [...this.createAsyncProvider(options), StorageService],
      exports: [StorageService],
    };
  }

  private static createAsyncProvider(options: StorageBaseModuleAsyncOptions): Provider[] {
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
  private static createAsyncOptionsProvider(options: StorageBaseModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: STORAGE_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: STORAGE_MODULE_OPTIONS,
      useFactory: async (optionsFactory: StorageBaseModuleOptionsFactory) =>
        await optionsFactory.createStorageBaseModuleOptions(),
      inject: [(options.useExisting || options.useClass) as Type<StorageBaseModuleOptionsFactory>],
    };
  }
}
