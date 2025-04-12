import { Provider } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BatchRepo } from '../models/batch.entity';
import { LocationEntity, LocationRepo } from '../models/location.entity';
import { MaterialRepo } from '../models/material.entity';
import {
  PROVIDE_BATCH_ENTITY,
  PROVIDE_LOCATION_ENTITY,
  PROVIDE_MATERIAL_ENTITY,
  RESOLVED_BATCH_REPO,
  RESOLVED_MATERIAL_REPO,
  RESOLVED_TREE_LOCATION_REPO,
} from '../typings/wms-module-providers';

const TARGETS = [
  [LocationRepo, PROVIDE_LOCATION_ENTITY, RESOLVED_TREE_LOCATION_REPO, true],
  [BatchRepo, PROVIDE_BATCH_ENTITY, RESOLVED_BATCH_REPO, false],
  [MaterialRepo, PROVIDE_MATERIAL_ENTITY, RESOLVED_MATERIAL_REPO, false],
] as const;

export const ResolvedRepoProviders = TARGETS.map<Provider>(
  ([repo, provide, resolved, isTreeRepo]) => ({
    provide: resolved,
    useFactory: <T extends LocationEntity>(
      baseRepo: Repository<T>,
      entity: new () => T,
      dataSource: DataSource,
    ) =>
      entity
        ? isTreeRepo
          ? dataSource.getTreeRepository(entity)
          : dataSource.getRepository(entity)
        : baseRepo,
    inject: [repo, provide, DataSource],
  }),
);
