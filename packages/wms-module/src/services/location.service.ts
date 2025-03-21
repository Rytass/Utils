import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeepPartial, Repository } from 'typeorm';
import { LocationEntity } from '../models/location.entity';
import { RESOLVED_LOCATION_REPO } from '../typings/wms-module-options.interface';

@Injectable()
export class LocationService<Entity extends LocationEntity = LocationEntity> {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    @Inject(RESOLVED_LOCATION_REPO)
    private readonly locationRepo: Repository<LocationEntity>,
  ) {}

  async createLocation(
    options: DeepPartial<Entity>,
    parentId?: string,
  ): Promise<DeepPartial<Entity>> {
    const location = await this.locationRepo.save({
      ...options,
    });

    if (parentId) {
      const parent = await this.locationRepo.findOne({
        where: { id: parentId },
      });

      if (parent) {
        await this.locationRepo.update(location.id, {
          parent,
        });
      }
    }

    return location;
  }
}
