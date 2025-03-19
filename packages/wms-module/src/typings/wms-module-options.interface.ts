import { StockEntity } from '../models/stock.entity';

export interface WmsModuleOptions {
  // Entities
  stockEntity?: new () => StockEntity; // default: StockEntity
}
