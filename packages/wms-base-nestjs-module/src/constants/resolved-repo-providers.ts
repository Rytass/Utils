import { Provider } from '@nestjs/common';
import { DataSource, EntitySchema, Repository, TreeRepository } from 'typeorm';
import { BatchRepo } from '../models/batch.entity';
import { LocationRepo } from '../models/location.entity';
import { MaterialRepo } from '../models/material.entity';
import { OrderRepo } from '../models/order.entity';
import { StockRepo } from '../models/stock.entity';
import {
  PROVIDE_BATCH_ENTITY,
  PROVIDE_LOCATION_ENTITY,
  PROVIDE_MATERIAL_ENTITY,
  PROVIDE_ORDER_ENTITY,
  PROVIDE_STOCK_ENTITY,
  PROVIDE_WAREHOUSE_MAP_ENTITY,
  RESOLVED_BATCH_REPO,
  RESOLVED_MATERIAL_REPO,
  RESOLVED_ORDER_REPO,
  RESOLVED_STOCK_REPO,
  RESOLVED_TREE_LOCATION_REPO,
  RESOLVED_WAREHOUSE_MAP_REPO,
} from '../typings/wms-base-module-providers';
import { WarehouseMapRepo } from '../models/warehouse-map.entity';

const TARGETS = [
  [LocationRepo, PROVIDE_LOCATION_ENTITY, RESOLVED_TREE_LOCATION_REPO, true],
  [BatchRepo, PROVIDE_BATCH_ENTITY, RESOLVED_BATCH_REPO, false],
  [MaterialRepo, PROVIDE_MATERIAL_ENTITY, RESOLVED_MATERIAL_REPO, false],
  [OrderRepo, PROVIDE_ORDER_ENTITY, RESOLVED_ORDER_REPO, false],
  [StockRepo, PROVIDE_STOCK_ENTITY, RESOLVED_STOCK_REPO, false],
  [WarehouseMapRepo, PROVIDE_WAREHOUSE_MAP_ENTITY, RESOLVED_WAREHOUSE_MAP_REPO, false],
] as const;

export const ResolvedRepoProviders = TARGETS.map<Provider>(([repo, provide, resolved, isTreeRepo]) => ({
  provide: resolved,
  useFactory: <T extends EntitySchema>(
    baseRepo: Repository<T>,
    entity: new () => T,
    dataSource: DataSource,
  ): Repository<T> | TreeRepository<T> =>
    entity ? (isTreeRepo ? dataSource.getTreeRepository(entity) : dataSource.getRepository(entity)) : baseRepo,
  inject: [repo, provide, DataSource],
}));
