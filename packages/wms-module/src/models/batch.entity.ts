import {
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Relation,
} from 'typeorm';
import { MaterialEntity } from './material.entity';
import { StockEntity } from './stock.entity';

export const BatchRepo = Symbol('BatchRepo');

@Entity('batches')
export class BatchEntity {
  @PrimaryColumn('varchar')
  id: string;

  @PrimaryColumn('varchar')
  materialId: string;

  @ManyToOne(() => MaterialEntity, (material) => material.batches)
  @JoinColumn({ name: 'materialId', referencedColumnName: 'id' })
  material: Relation<MaterialEntity>;

  @OneToMany(() => StockEntity, (stock) => stock.batch)
  stocks: Relation<StockEntity[]>;
}
