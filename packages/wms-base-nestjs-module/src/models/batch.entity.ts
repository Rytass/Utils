import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { MaterialEntity } from './material.entity';
import { StockEntity } from './stock.entity';

export const BatchRepo = Symbol('BatchRepo');

@Entity('batches')
@Unique(['key', 'materialId'])
export class BatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  key: string;

  @Column('varchar')
  materialId: string;

  @ManyToOne(() => MaterialEntity, material => material.batches)
  @JoinColumn({ name: 'materialId', referencedColumnName: 'id' })
  material: Relation<MaterialEntity>;

  @OneToMany(() => StockEntity, stock => stock.batch)
  stocks: Relation<StockEntity[]>;
}
