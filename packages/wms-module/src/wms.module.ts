import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LocationEntity, LocationRepo } from './models/location.entity';
import { WMSModelsModule } from './models/wms-models.module';
import { LocationService } from './services/location.service';
import {
  RESOLVED_LOCATION_REPO,
  WmsModuleAsyncOptions,
  WmsModuleOptions,
  WmsModuleOptionsFactory,
} from './typings/wms-module-options.interface';

const PROVIDE_LOCATION_ENTITY = Symbol('PROVIDE_LOCATION_ENTITY');
const WMS_MODULE_OPTIONS = Symbol('WMS_MODULE_OPTIONS');

const TARGETS = [
  [LocationRepo, PROVIDE_LOCATION_ENTITY, RESOLVED_LOCATION_REPO],
];

const ResolvedRepoProviders = TARGETS.map<Provider>(
  ([repo, provide, resolved]) => ({
    provide: resolved,
    useFactory: <T extends LocationEntity>(
      baseRepo: Repository<T>,
      entity: new () => T,
      dataSource: DataSource,
    ) => (entity ? dataSource.getRepository(entity) : baseRepo),
    inject: [repo, provide, DataSource],
  }),
);

const OptionProviders = [
  {
    provide: PROVIDE_LOCATION_ENTITY,
    useFactory: (options?: WmsModuleOptions) => options?.locationEntity ?? null,
    inject: [WMS_MODULE_OPTIONS],
  },
];

const providers = [...OptionProviders, ...ResolvedRepoProviders];

@Module({
  imports: [WMSModelsModule],
  exports: [LocationService],
  providers: [LocationService, ...providers],
})
export class WMSModule {
  static forRoot(options: WmsModuleOptions): DynamicModule {
    return {
      module: WMSModule,
      providers: [
        {
          provide: WMS_MODULE_OPTIONS,
          useValue: options,
        },
      ],
    };
  }

  static forRootAsync(options: WmsModuleAsyncOptions): DynamicModule {
    return {
      module: WMSModule,
      imports: [...(options?.imports ?? []), WMSModelsModule],
      providers: [...this.createAsyncProvider(options), ...providers],
    };
  }

  private static createAsyncProvider(
    options: WmsModuleAsyncOptions,
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
    options: WmsModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: WMS_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: WMS_MODULE_OPTIONS,
      useFactory: async (optionsFactory: any) =>
        await optionsFactory.createWmsModuleOptions(),
      inject: [
        (options.useExisting ||
          options.useClass) as Type<WmsModuleOptionsFactory>,
      ],
    };
  }
}
