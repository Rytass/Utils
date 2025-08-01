import { Inject, Injectable, Logger } from '@nestjs/common';
import { WarehouseMapEntity } from '../models/warehouse-map.entity';
import { RESOLVED_WAREHOUSE_MAP_REPO } from '../typings/wms-base-module-providers';
import { Repository } from 'typeorm';
import { MapBackgroundInput } from 'wms-base-nestjs-module/dto/map-background.input';
import { MapRangeInput } from 'wms-base-nestjs-module/dto/map-range-input';
import {
  MapBackground,
  MapData,
  MapPolygonRange,
  MapRectangleRange,
} from '../typings/warehouse-map';
import { MapRangeType } from '../typings/warehouse-map.enum';

@Injectable()
export class WarehouseMapService {
  private readonly logger = new Logger(WarehouseMapService.name);

  constructor(
    @Inject(RESOLVED_WAREHOUSE_MAP_REPO)
    private readonly warehouseMapRepo: Repository<WarehouseMapEntity>,
  ) {}

  async updateMap(
    locationId: string,
    backgrounds: MapBackgroundInput[],
    ranges: MapRangeInput[],
  ): Promise<WarehouseMapEntity> {
    const entity =
      (await this.warehouseMapRepo.findOne({ where: { id: locationId } })) ??
      this.warehouseMapRepo.create({
        id: locationId,
        mapData: { id: locationId, backgrounds: [], ranges: [] },
      });

    const mapData: MapData = {
      id: locationId,
      backgrounds: backgrounds.map(
        (bg): MapBackground => ({
          id: bg.id,
          filename: bg.filename,
          x: bg.x,
          y: bg.y,
          height: bg.height,
          width: bg.width,
        }),
      ),
      ranges: ranges.map((range): MapRectangleRange | MapPolygonRange => {
        const base = {
          id: range.id,
          type: range.type,
          color: range.color,
        };

        if (range.type === MapRangeType.RECTANGLE) {
          return {
            ...base,
            x: range.x!,
            y: range.y!,
            width: range.width!,
            height: range.height!,
          };
        } else {
          return {
            ...base,
            points: range.points!,
          };
        }
      }),
    };

    entity.mapData = mapData;

    return this.warehouseMapRepo.save(entity);
  }

  async getMapById(id: string): Promise<MapData> {
    const entity = await this.warehouseMapRepo.findOne({
      where: { id },
    });

    if (!entity) {
      return {
        id,
        backgrounds: [],
        ranges: [],
      };
    }

    return {
      ...entity.mapData,
      id: entity.id,
    };
  }

  async deleteMapById(id: string): Promise<boolean> {
    const entity = await this.warehouseMapRepo.findOne({
      where: { id },
    });

    if (!entity) return true;

    await this.warehouseMapRepo.remove(entity);

    return true;
  }
}
