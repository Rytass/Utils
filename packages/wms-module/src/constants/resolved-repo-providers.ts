import { Provider } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LocationEntity, LocationRepo } from '../models/location.entity';
import {
  PROVIDE_LOCATION_ENTITY,
  RESOLVED_LOCATION_REPO,
} from '../typings/wms-module-providers';

const TARGETS = [
  [LocationRepo, PROVIDE_LOCATION_ENTITY, RESOLVED_LOCATION_REPO],
];

export const ResolvedRepoProviders = TARGETS.map<Provider>(
  ([repo, provide, resolved]) => ({
    provide: resolved,
    useFactory: <T extends LocationEntity>(
      baseRepo: Repository<T>,
      entity: new () => T,
      dataSource: DataSource,
    ) => (entity ? dataSource.getTreeRepository(entity) : baseRepo),
    inject: [repo, provide, DataSource],
  }),
);
