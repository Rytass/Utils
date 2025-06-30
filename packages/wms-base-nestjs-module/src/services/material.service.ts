import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MaterialEntity } from '../models/material.entity';
import { RESOLVED_MATERIAL_REPO } from '../typings/wms-base-module-providers';

@Injectable()
export class MaterialService<Entity extends MaterialEntity = MaterialEntity> {
  constructor(
    @Inject(RESOLVED_MATERIAL_REPO)
    private readonly materialRepo: Repository<MaterialEntity>,
  ) {}

  async create(options: Partial<Entity>): Promise<MaterialEntity> {
    const material = await this.materialRepo.save(options);

    return material;
  }
}
