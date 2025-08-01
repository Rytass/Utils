import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { OptionProviders } from './constants/option-providers';
import { ResolvedRepoProviders } from './constants/resolved-repo-providers';
import { WMSModelsModule } from './models/wms-models.module';
import { LocationService } from './services/location.service';
import { MaterialService } from './services/material.service';
import { OrderService } from './services/order.service';
import { StockService } from './services/stock.service';
import {
  WMSBaseModuleAsyncOptions,
  WMSBaseModuleOptions,
  WMSBaseModuleOptionsFactory,
} from './typings/wms-base-module-options.interface';
import { WMS_MODULE_OPTIONS } from './typings/wms-base-module-providers';
import { WarehouseMapService } from './services/warehouse-map.service';

const providers = [...OptionProviders, ...ResolvedRepoProviders];

@Module({
  imports: [WMSModelsModule],
  exports: [
    LocationService,
    MaterialService,
    StockService,
    OrderService,
    WarehouseMapService,
  ],
  providers: [
    LocationService,
    MaterialService,
    StockService,
    OrderService,
    WarehouseMapService,
    ...providers,
  ],
})
export class WMSBaseModule {
  static forRoot(options: WMSBaseModuleOptions): DynamicModule {
    return {
      module: WMSBaseModule,
      providers: [
        {
          provide: WMS_MODULE_OPTIONS,
          useValue: options,
        },
      ],
    };
  }

  static forRootAsync(options: WMSBaseModuleAsyncOptions): DynamicModule {
    return {
      module: WMSBaseModule,
      imports: [...(options?.imports ?? []), WMSModelsModule],
      providers: [...this.createAsyncProvider(options), ...providers],
    };
  }

  private static createAsyncProvider(
    options: WMSBaseModuleAsyncOptions,
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
    options: WMSBaseModuleAsyncOptions,
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
        await optionsFactory.createWMSBaseModuleOptions(),
      inject: [
        (options.useExisting ||
          options.useClass) as Type<WMSBaseModuleOptionsFactory>,
      ],
    };
  }
}
