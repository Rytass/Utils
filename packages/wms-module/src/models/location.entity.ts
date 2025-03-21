import {
  AfterLoad,
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
export abstract class LocationEntity {
  @PrimaryGeneratedColumn('increment')
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

  @AfterLoad()
  stringify(): void {
    this.id = this.id.toString();
  }
}
