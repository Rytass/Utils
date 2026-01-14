import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  type Relation,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import { BatchEntity } from './batch.entity';
import { StockEntity } from './stock.entity';

export const MaterialRepo = Symbol('MaterialRepo');

@Entity('materials')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class MaterialEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  key: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(() => BatchEntity, batch => batch.material)
  batches: Relation<BatchEntity[]>;

  @OneToMany(() => StockEntity, stock => stock.material)
  stocks: Relation<StockEntity[]>;
}
