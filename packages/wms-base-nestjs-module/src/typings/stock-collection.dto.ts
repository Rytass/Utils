import { StockEntity } from '../models/stock.entity';

export type StockTransactionLogDto<Stock extends StockEntity = StockEntity> =
  Omit<Stock, 'material' | 'batch' | 'location' | 'order'>;

export interface StockCollectionDto {
  transactionLogs: StockTransactionLogDto[];
  total: number;
  offset: number;
  limit: number;
}
