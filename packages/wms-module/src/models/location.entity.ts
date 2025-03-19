import {
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Tree,
  TreeChildren,
  TreeParent,
  UpdateDateColumn,
} from 'typeorm';

export const LocationRepo = Symbol('LocationRepo');

@Entity('locations')
@Tree('materialized-path')
export class Location {
  @PrimaryGeneratedColumn('increment')
  id: string;

  @TreeChildren()
  children: Location[];

  @TreeParent()
  parent: Location;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
