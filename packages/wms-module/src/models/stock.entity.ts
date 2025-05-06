import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  TableInheritance,
} from 'typeorm';
import { BatchEntity } from './batch.entity';
import { MaterialEntity } from './material.entity';

export const StockRepo = Symbol('StockRepo');
@Entity('stocks')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class StockEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  materialId: string;

  @Column({ type: 'varchar' })
  batchId: string;

  @Column({ type: 'varchar' })
  locationId: string;

  @Column({ type: 'numeric' })
  quantity: number;

  @ManyToOne(() => MaterialEntity, (material) => material.stocks)
  @JoinColumn({ name: 'materialId', referencedColumnName: 'id' })
  material: Relation<MaterialEntity>;

  @ManyToOne(() => BatchEntity, (batch) => batch.stocks)
  @JoinColumn({ name: 'batchId', referencedColumnName: 'id' })
  batch: Relation<BatchEntity>;

  @CreateDateColumn()
  createdAt: Date;
}
