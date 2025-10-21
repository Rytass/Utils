import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import {
  StorageAdapter,
  StorageBaseModuleAsyncOptions,
  StorageBaseModuleOptions,
  StorageBaseModuleOptionsFactory,
} from './typings/storage-base-module-options.interface';
import { STORAGE_ADAPTER, STORAGE_MODULE_OPTIONS } from './typings/storages-base-module-providers';
import { StorageService } from './services/storage.service';

@Global()
@Module({})
export class StorageBaseModule {
  static forRoot(options: StorageBaseModuleOptions): DynamicModule {
    const optionsProvider = {
      provide: STORAGE_MODULE_OPTIONS,
      useValue: options,
    };

    const adapterProvider = {
      provide: STORAGE_ADAPTER,
      useFactory: (): StorageAdapter => {
        const AdapterClass = options.adapter;

        if (!AdapterClass) {
          throw new Error('No storage adapter class was provided in forRoot!');
        }

        return new AdapterClass(options.config);
      },
    };

    return {
      module: StorageBaseModule,
      providers: [optionsProvider, adapterProvider, StorageService],
      exports: [StorageService],
    };
  }
  static forRootAsync(options: StorageBaseModuleAsyncOptions): DynamicModule {
    const asyncAdapterProviders: Provider = {
      provide: STORAGE_ADAPTER,
      useFactory: (options: StorageBaseModuleOptions): StorageAdapter => {
        const AdapterClass = options.adapter;

        if (!AdapterClass) {
          throw new Error('No storage adapter class was provided in forRootAsync!');
        }

        return new AdapterClass(options.config);
      },
      inject: [STORAGE_MODULE_OPTIONS],
    };

    return {
      module: StorageBaseModule,
      imports: [...(options?.imports ?? [])],
      providers: [...this.createAsyncProvider(options), asyncAdapterProviders, StorageService],
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
