import { LocationEntity } from '../models/location.entity';
import { StockEntity } from '../models/stock.entity';

export interface WmsModuleOptions {
  // Entities
  stockEntity?: new () => StockEntity; // default: StockEntity
  locationEntity?: new () => LocationEntity; // default: LocationEntity
}
