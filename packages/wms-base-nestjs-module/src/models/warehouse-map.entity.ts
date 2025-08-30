import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { MapData } from '../typings/warehouse-map';

export const WarehouseMapRepo = Symbol('WarehouseMapRepo');

@Entity('warehouse_maps')
export class WarehouseMapEntity {
  @PrimaryColumn('varchar') // location Id like 'A001A'
  id: string;

  @Column({ type: 'jsonb' })
  mapData: MapData;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
