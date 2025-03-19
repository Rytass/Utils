import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { BatchEntity } from './batch.entity';
import { MaterialEntity } from './material.entity';

export const StockRepo = Symbol('StockRepo');
@Entity('stocks')
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
  material: Relation<MaterialEntity>;

  @ManyToOne(() => BatchEntity, (batch) => batch.stocks)
  batch: Relation<BatchEntity>;
}
