import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeepPartial, TreeRepository } from 'typeorm';
import { LocationEntity } from '../models/location.entity';
import { RESOLVED_LOCATION_REPO } from '../typings/wms-module-providers';

@Injectable()
export class LocationService<Entity extends LocationEntity = LocationEntity> {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    @Inject(RESOLVED_LOCATION_REPO)
    private readonly locationRepo: TreeRepository<LocationEntity>,
  ) {}

  async createLocation(
    options: DeepPartial<Entity>,
    parentId?: string,
  ): Promise<DeepPartial<Entity>> {
    const parent = parentId
      ? await this.locationRepo.findOne({
          where: { id: parentId },
        })
      : undefined;

    const location = await this.locationRepo.save({
      ...options,
      parent,
    });

    return location;
  }
}
