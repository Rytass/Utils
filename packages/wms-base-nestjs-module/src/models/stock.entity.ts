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

  @Column({ type: 'numeric' })
  quantity: number;

  @ManyToOne(() => MaterialEntity, material => material.stocks)
  @JoinColumn({ name: 'materialId', referencedColumnName: 'id' })
  material: Relation<MaterialEntity>;

  @ManyToOne(() => BatchEntity, batch => batch.stocks)
  @JoinColumn([
    {
      name: 'materialId',
      referencedColumnName: 'materialId',
    },
    { name: 'batchId', referencedColumnName: 'id' },
  ])
  batch: Relation<BatchEntity>;

  @ManyToOne(() => OrderEntity, order => order.stocks)
  @JoinColumn({
    name: 'orderId',
    referencedColumnName: 'id',
  })
  order: Relation<OrderEntity>;

  @CreateDateColumn()
  createdAt: Date;
}
