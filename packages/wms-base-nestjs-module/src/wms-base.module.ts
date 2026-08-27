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
import {
  ALLOW_NEGATIVE_STOCK,
  PROVIDE_BATCH_ENTITY,
  PROVIDE_LOCATION_ENTITY,
  PROVIDE_MATERIAL_ENTITY,
  PROVIDE_ORDER_ENTITY,
  PROVIDE_STOCK_ENTITY,
  PROVIDE_WAREHOUSE_MAP_ENTITY,
  RESOLVED_BATCH_REPO,
  RESOLVED_MATERIAL_REPO,
  RESOLVED_ORDER_REPO,
  RESOLVED_STOCK_REPO,
  RESOLVED_TREE_LOCATION_REPO,
  RESOLVED_WAREHOUSE_MAP_REPO,
  WMS_MODULE_OPTIONS,
} from './typings/wms-base-module-providers';
import { WarehouseMapService } from './services/warehouse-map.service';

const providers = [...OptionProviders, ...ResolvedRepoProviders];

/**
 * Everything a module layered on top of this one needs to stay in step with the
 * entity overrides.
 *
 * Without these, `WMSBaseModuleOptions.materialEntity` (and its siblings) reach
 * only this module's own services: an upper layer cannot see which entity was
 * configured, so it has to hard-code the built-in class and ends up writing to a
 * different single-table-inheritance discriminator than the base module reads
 * from. Exporting the resolved tokens is what makes the override a contract for
 * the whole stack rather than a private detail of this package.
 *
 * `PROVIDE_*_ENTITY` carries the configured class (or `null` when the consumer
 * left it out) and `RESOLVED_*_REPO` the repository it resolves to; an upper
 * layer usually wants the former to rebind its own entity token and the latter
 * to read through the base module's repository directly.
 */
const exportedTokens = [
  WMS_MODULE_OPTIONS,
  ALLOW_NEGATIVE_STOCK,
  PROVIDE_LOCATION_ENTITY,
  PROVIDE_MATERIAL_ENTITY,
  PROVIDE_BATCH_ENTITY,
  PROVIDE_ORDER_ENTITY,
  PROVIDE_STOCK_ENTITY,
  PROVIDE_WAREHOUSE_MAP_ENTITY,
  RESOLVED_TREE_LOCATION_REPO,
  RESOLVED_MATERIAL_REPO,
  RESOLVED_BATCH_REPO,
  RESOLVED_ORDER_REPO,
  RESOLVED_STOCK_REPO,
  RESOLVED_WAREHOUSE_MAP_REPO,
];

@Module({
  imports: [WMSModelsModule],
  exports: [
    LocationService,
    MaterialService,
    StockService,
    OrderService,
    WarehouseMapService,
    WMSModelsModule,
    ...exportedTokens,
  ],
  providers: [LocationService, MaterialService, StockService, OrderService, WarehouseMapService, ...providers],
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

  private static createAsyncProvider(options: WMSBaseModuleAsyncOptions): Provider[] {
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
  private static createAsyncOptionsProvider(options: WMSBaseModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: WMS_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: WMS_MODULE_OPTIONS,
      useFactory: async (optionsFactory: WMSBaseModuleOptionsFactory) =>
        await optionsFactory.createWMSBaseModuleOptions(),
      inject: [(options.useExisting || options.useClass) as Type<WMSBaseModuleOptionsFactory>],
    };
  }
}
