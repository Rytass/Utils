import {
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  TableInheritance,
  Tree,
  TreeChildren,
  TreeParent,
  UpdateDateColumn,
} from 'typeorm';

export const LocationRepo = Symbol('LocationRepo');

@Entity('locations')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
@Tree('materialized-path')
export class LocationEntity {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @TreeChildren()
  children: LocationEntity[];

  @TreeParent()
  parent: LocationEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
