import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { TurnkeyTaxType } from '../typings/turnkey-enums';
import type { TurnkeyItemTaxType } from '../typings/turnkey-invoice.types';
import { numericTransformer } from '../utils/numeric-transformer';
import { BaseTurnkeyInvoiceEntity } from './turnkey-invoice.entity';

export const TurnkeyInvoiceItemRepo = Symbol('TurnkeyInvoiceItemRepo');

@Entity('turnkey_invoice_items')
export class TurnkeyInvoiceItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  invoiceId: string;

  @Column('smallint')
  sequenceNumber: number;

  @Column('varchar', { length: 500 })
  description: string;

  @Column('numeric', { precision: 20, scale: 7, transformer: numericTransformer })
  quantity: number;

  @Column('varchar', { nullable: true })
  unit: string | null;

  @Column('numeric', { precision: 20, scale: 7, transformer: numericTransformer })
  unitPrice: number;

  @Column('numeric', { precision: 20, scale: 7, transformer: numericTransformer })
  amount: number;

  @Column('enum', { enum: TurnkeyTaxType })
  taxType: TurnkeyItemTaxType;

  @Column('varchar', { nullable: true })
  remark: string | null;

  @ManyToOne(() => BaseTurnkeyInvoiceEntity, invoice => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Relation<BaseTurnkeyInvoiceEntity>;
}
