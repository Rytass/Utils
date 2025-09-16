import { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import { BatchEntity } from '../models/batch.entity';
import { LocationEntity } from '../models/location.entity';
import { MaterialEntity } from '../models/material.entity';
import { OrderEntity } from '../models/order.entity';
import { StockEntity } from '../models/stock.entity';
import { WarehouseMapEntity } from '../models/warehouse-map.entity';

export interface WMSBaseModuleOptions {
  // Entities
  stockEntity?: new () => StockEntity; // default: StockEntity
  locationEntity?: new () => LocationEntity; // default: LocationEntity
  materialEntity?: new () => MaterialEntity; // default: MaterialEntity
  batchEntity?: new () => BatchEntity; // default: BatchEntity
  orderEntity?: new () => OrderEntity; // default: OrderEntity
  warehouseMapEntity?: new () => WarehouseMapEntity; // default: WarehouseMapEntity
  // Options
  allowNegativeStock?: boolean; // default: false
}

export interface WMSBaseModuleOptionsFactory {
  createWMSBaseModuleOptions(): Promise<WMSBaseModuleOptions> | WMSBaseModuleOptions;
}

export interface WMSBaseModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: (InjectionToken | OptionalFactoryDependency)[]
  ) => Promise<WMSBaseModuleOptions> | WMSBaseModuleOptions;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<WMSBaseModuleOptionsFactory>;
  useExisting?: Type<WMSBaseModuleOptionsFactory>;
}
