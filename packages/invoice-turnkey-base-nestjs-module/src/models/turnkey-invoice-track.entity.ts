import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TurnkeyTrackSource } from '../typings/turnkey-enums';

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

  /** 手動登錄或 E0501 配號檔匯入；既有資料列遷移後為 MANUAL */
  @Column('varchar', { length: 20, default: TurnkeyTrackSource.MANUAL })
  source: TurnkeyTrackSource;

  /** 配號檔的發票類別（07 一般稅額、08 特種稅額）；手動登錄為 null */
  @Column('varchar', { length: 2, nullable: true })
  invoiceType: string | null;

  /** 匯入來源的 E0501 檔名；手動登錄為 null */
  @Column('varchar', { nullable: true })
  sourceFileName: string | null;

  /** Turnkey 收到配號檔的時間（檔案寫入 Unpack/BAK 的時間）；手動登錄為 null */
  @Column('timestamptz', { nullable: true })
  receivedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
