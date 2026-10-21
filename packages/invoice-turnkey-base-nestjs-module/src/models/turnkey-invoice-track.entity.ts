import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export const TurnkeyInvoiceTrackRepo = Symbol('TurnkeyInvoiceTrackRepo');

@Entity('turnkey_invoice_tracks')
@Unique(['companyTaxId', 'period', 'track', 'beginNumber'])
export class TurnkeyInvoiceTrackEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 8 })
  companyTaxId: string;

  /** 民國年 3 碼＋雙數月，例如 11510 */
  @Column('varchar', { length: 5 })
  period: string;

  @Column('varchar', { length: 2 })
  track: string;

  @Column('varchar', { length: 8 })
  beginNumber: string;

  @Column('varchar', { length: 8 })
  endNumber: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
