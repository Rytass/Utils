import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { OptionProviders } from './constants/option-providers';
import { ResolvedRepoProviders } from './constants/resolved-repo-providers';
import { WMSModelsModule } from './models/wms-models.module';
import { LocationService } from './services/location.service';
import { MaterialService } from './services/material.service';
import { OrderService } from './services/order.service';
import { StockService } from './services/stock.service';
import {
  WmsModuleAsyncOptions,
  WmsModuleOptions,
  WmsModuleOptionsFactory,
} from './typings/wms-module-options.interface';
import { WMS_MODULE_OPTIONS } from './typings/wms-module-providers';

const providers = [...OptionProviders, ...ResolvedRepoProviders];

@Module({
  imports: [WMSModelsModule],
  exports: [LocationService, MaterialService, StockService, OrderService],
  providers: [
    LocationService,
    MaterialService,
    StockService,
    OrderService,
    ...providers,
  ],
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
    const flatRepoProviders: any[] = [];

    return {
      module: WMSModule,
      imports: [...(options?.imports ?? []), WMSModelsModule],
      providers: [
        ...this.createAsyncProvider(options),
        ...flatRepoProviders,
        ...providers,
      ],
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
