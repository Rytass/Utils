import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import { DataSource } from 'typeorm';
import { BatchEntity, BatchRepo } from './batch.entity';
import { LocationEntity, LocationRepo } from './location.entity';
import { MaterialEntity, MaterialRepo } from './material.entity';
import { OrderEntity, OrderRepo } from './order.entity';
import { StockEntity, StockRepo } from './stock.entity';
import { WarehouseMapEntity, WarehouseMapRepo } from './warehouse-map.entity';

const models: [symbol: symbol, cls: EntityClassOrSchema][] = [
  [BatchRepo, BatchEntity],
  [StockRepo, StockEntity],
  [MaterialRepo, MaterialEntity],
  [LocationRepo, LocationEntity],
  [OrderRepo, OrderEntity],
  [WarehouseMapRepo, WarehouseMapEntity],
];

@Module({
  imports: [TypeOrmModule.forFeature(models.map(([, entity]) => entity))],
  providers: models.map(([symbol, entity]) => ({
    provide: symbol,
    inject: [DataSource],
    useFactory: (dataSource: DataSource) => dataSource.getRepository(entity),
  })),
  exports: models.map(([symbol]) => symbol),
})
export class WMSModelsModule {}
