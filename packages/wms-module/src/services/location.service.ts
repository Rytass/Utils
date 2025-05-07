import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  TreeRepository,
} from 'typeorm';
import {
  LocationAlreadyExistedError,
  LocationCannotArchiveError,
  LocationNotFoundError,
} from '../constants/errors/base.error';
import { LocationEntity } from '../models/location.entity';
import { RESOLVED_TREE_LOCATION_REPO } from '../typings/wms-module-providers';
import { StockService } from './stock.service';

@Injectable()
export class LocationService<Entity extends LocationEntity = LocationEntity> {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    @Inject(RESOLVED_TREE_LOCATION_REPO)
    private readonly locationTreeRepo: TreeRepository<LocationEntity>,
    @Inject(StockService)
    private readonly stockService: StockService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    options: DeepPartial<Entity>,
    parentId?: string,
  ): Promise<DeepPartial<Entity>> {
    const parent = parentId
      ? await this.locationTreeRepo
          .findOneOrFail({
            where: { id: parentId },
          })
          .catch(() => {
            throw new LocationNotFoundError();
          })
      : undefined;

    const hasExistingLocation = await this.locationTreeRepo.count({
      where: {
        id: options.id,
      },
      withDeleted: true,
    });

    if (hasExistingLocation) {
      throw new LocationAlreadyExistedError();
    }

    const location = await this.locationTreeRepo.save({
      ...options,
      parent,
    });

    return location;
  }

  async archive(id: string): Promise<void> {
    const location = await this.locationTreeRepo.findOne({
      where: { id },
    });

    if (!location) {
      throw new LocationNotFoundError();
    }

    await this.dataSource.transaction(async (manager) => {
      const canArchive = await this.canArchive(id, manager);

      if (!canArchive) {
        throw new LocationCannotArchiveError();
      }

      const descendants = await this.locationTreeRepo.findDescendants(location);

      await this.locationTreeRepo.softDelete(descendants.map((d) => d.id));
    });
  }

  async unArchive(id: string): Promise<LocationEntity> {
    const location = await this.locationTreeRepo.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!location) {
      throw new LocationNotFoundError();
    }

    await this.locationTreeRepo.restore(id);

    return location;
  }

  private async canArchive(
    id: string,
    manager: EntityManager,
  ): Promise<boolean> {
    return this.stockService
      .find(
        {
          locationIds: [id],
        },
        manager,
      )
      .then((quantity) => quantity === 0);
  }
}
