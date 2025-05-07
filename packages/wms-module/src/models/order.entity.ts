import {
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  TableInheritance,
} from 'typeorm';
import { StockEntity } from './stock.entity';

export const OrderRepo = Symbol('OrderRepo');

@Entity('orders')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(() => StockEntity, (stock) => stock.order)
  stocks: Relation<StockEntity>[];
}
