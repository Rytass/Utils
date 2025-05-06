export interface StockFindDto {
  locationIds?: string[]; // Location must have at least one of these locations
  materialIds?: string[]; // Material must have at least one of these materials
  batchIds?: string[]; // Batch must have at least one of these batches
}
