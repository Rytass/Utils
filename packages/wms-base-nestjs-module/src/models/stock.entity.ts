import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  TableInheritance,
} from 'typeorm';
import { BatchEntity } from './batch.entity';
import { MaterialEntity } from './material.entity';
import { OrderEntity } from './order.entity';

export const StockRepo = Symbol('StockRepo');
@Entity('stocks')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class StockEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  materialId: string;

  @Column({ type: 'uuid' })
  @Index()
  batchId: string;

  @Column({ type: 'uuid' })
  @Index()
  locationId: string;

  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  // PostgreSQL drivers return numeric as a string; keep the declared type true.
  @Column({
    type: 'numeric',
    transformer: {
      to: (value: number): number => value,
      from: (value: string | number | null): number | null => (value === null ? null : Number(value)),
    },
  })
  quantity: number;

  @ManyToOne(() => MaterialEntity, material => material.stocks)
  @JoinColumn({ name: 'materialId', referencedColumnName: 'id' })
  material: Relation<MaterialEntity>;

  @ManyToOne(() => BatchEntity, batch => batch.stocks)
  @JoinColumn({ name: 'batchId', referencedColumnName: 'id' })
  batch: Relation<BatchEntity>;

  @ManyToOne(() => OrderEntity, order => order.stocks)
  @JoinColumn({ name: 'orderId', referencedColumnName: 'id' })
  order: Relation<OrderEntity>;

  @CreateDateColumn()
  createdAt: Date;
}
