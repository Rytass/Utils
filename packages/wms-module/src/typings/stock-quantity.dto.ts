export interface StockQuantityDto {
  quantity: number;
  batchId: string;
  locationId: string;
  materialId: string;
}

export interface StockCollectionDto {
  quantity: number;
  transactionLogs: StockQuantityDto[];
}
