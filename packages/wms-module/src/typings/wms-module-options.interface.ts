import { ModuleMetadata, Type } from '@nestjs/common';
import { LocationEntity } from '../models/location.entity';
import { StockEntity } from '../models/stock.entity';

export interface WmsModuleOptions {
  // Entities
  stockEntity?: new () => StockEntity; // default: StockEntity
  locationEntity?: new () => LocationEntity; // default: LocationEntity
}

export interface WmsModuleOptionsFactory {
  createWmsModuleOptions(): Promise<WmsModuleOptions> | WmsModuleOptions;
}

export interface WmsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (...args: any[]) => Promise<WmsModuleOptions> | WmsModuleOptions;
  inject?: any[];
  useClass?: Type<WmsModuleOptionsFactory>;
  useExisting?: Type<WmsModuleOptionsFactory>;
}
