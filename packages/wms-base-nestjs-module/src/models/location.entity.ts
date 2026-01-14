import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  @Index()
  key: string;

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
