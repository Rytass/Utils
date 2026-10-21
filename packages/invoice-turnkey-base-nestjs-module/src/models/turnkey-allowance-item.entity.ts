import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { TurnkeyTaxType } from '../typings/turnkey-enums';
import type { TurnkeyItemTaxType } from '../typings/turnkey-invoice.types';
import { numericTransformer } from '../utils/numeric-transformer';
import { TurnkeyAllowanceEntity } from './turnkey-allowance.entity';

export const TurnkeyAllowanceItemRepo = Symbol('TurnkeyAllowanceItemRepo');

@Entity('turnkey_allowance_items')
export class TurnkeyAllowanceItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  allowanceId: string;

  @Column('smallint')
  sequenceNumber: number;

  @Column('smallint', { nullable: true })
  originalSequenceNumber: number | null;

  @Column('varchar', { length: 500 })
  description: string;

  @Column('numeric', { precision: 20, scale: 7, transformer: numericTransformer })
  quantity: number;

  /** 未稅單價 */
  @Column('numeric', { precision: 20, scale: 7, transformer: numericTransformer })
  unitPrice: number;

  /** 未稅金額 */
  @Column('integer')
  amount: number;

  @Column('integer')
  tax: number;

  @Column('enum', { enum: TurnkeyTaxType })
  taxType: TurnkeyItemTaxType;

  @ManyToOne(() => TurnkeyAllowanceEntity, allowance => allowance.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'allowanceId' })
  allowance: Relation<TurnkeyAllowanceEntity>;
}
