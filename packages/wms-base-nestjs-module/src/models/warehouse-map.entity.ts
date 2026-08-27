import { Column, CreateDateColumn, Entity, PrimaryColumn, TableInheritance, UpdateDateColumn } from 'typeorm';
import type { MapData } from '../typings/warehouse-map';

export const WarehouseMapRepo = Symbol('WarehouseMapRepo');

@Entity('warehouse_maps')
// The only base entity that lacked this, which made `warehouseMapEntity` the one
// override TypeORM could not build: a `@ChildEntity()` of a parent without table
// inheritance has no parent metadata and dies on `ownColumns`. Adds a nullable
// `entityName` discriminator column; existing rows keep NULL and stay readable,
// because a single-table root is queried without a discriminator filter.
@TableInheritance({ column: { type: 'varchar', name: 'entityName', nullable: true } })
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
