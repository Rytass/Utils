import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  Relation,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import { BatchEntity } from './batch.entity';
import { StockEntity } from './stock.entity';

export const MaterialRepo = Symbol('MaterialRepo');

@Entity('materials')
@Index(['sku'], { unique: true, where: '"deletedAt" IS NULL' })
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class MaterialEntity {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar' })
  sku: string;

  @Column({ type: 'varchar' })
  unit: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(() => BatchEntity, (batch) => batch.material)
  batches: Relation<BatchEntity[]>;

  @OneToMany(() => StockEntity, (stock) => stock.material)
  stocks: Relation<StockEntity[]>;
}
