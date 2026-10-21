import { Column, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { TurnkeyNumberStatus } from '../typings/turnkey-enums';

export const TurnkeyInvoiceNumberRepo = Symbol('TurnkeyInvoiceNumberRepo');

@Entity('turnkey_invoice_numbers')
@Unique(['companyTaxId', 'invoiceNumber'])
@Index(['companyTaxId', 'period', 'status', 'invoiceNumber'])
export class TurnkeyInvoiceNumberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 8 })
  companyTaxId: string;

  @Column('uuid')
  trackId: string;

  @Column('varchar', { length: 5 })
  period: string;

  /** 字軌＋8 碼，例如 ZZ00000600 */
  @Column('varchar', { length: 10 })
  invoiceNumber: string;

  @Column('enum', { enum: TurnkeyNumberStatus, default: TurnkeyNumberStatus.AVAILABLE })
  status: TurnkeyNumberStatus;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
