import { getMetadataArgsStorage } from 'typeorm';
import { StockEntity } from '../src/models/stock.entity';

// The specs run on SQLite, which has no timestamptz. Map it to datetime here so
// the entity keeps the PostgreSQL type it ships with.
getMetadataArgsStorage()
  .columns.filter(column => column.target === StockEntity && column.options.type === 'timestamptz')
  .forEach(column => {
    column.options.type = 'datetime';
  });
