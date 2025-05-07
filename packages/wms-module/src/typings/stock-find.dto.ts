import { StockSorter } from './stock-sorter.enum';

export interface StockFindDto {
  locationIds?: string[]; // Location must have at least one of these locations
  materialIds?: string[]; // Material must have at least one of these materials
  batchIds?: string[]; // Batch must have at least one of these batches
}

export interface StockFindAllDto extends StockFindDto {
  offset?: number; // default: 0
  limit?: number; // default: 20, max: 100
  sorter?: StockSorter; // default: StockSorter.CREATED_AT_DESC
}
