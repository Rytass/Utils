import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TurnkeyPrintDocumentType, TurnkeyProofFormat } from '../typings/turnkey-enums';

export const TurnkeyPrintLogRepo = Symbol('TurnkeyPrintLogRepo');

/** 每次列印與補印各一筆；第 2 次起的證明聯加註「補印」 */
@Entity('turnkey_print_logs')
@Index(['companyTaxId', 'documentType', 'documentNumber'])
@Index(['companyTaxId', 'documentType', 'documentNumber', 'idempotencyKey'], { unique: true })
export class TurnkeyPrintLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 8 })
  companyTaxId: string;

  @Column('enum', { enum: TurnkeyPrintDocumentType })
  documentType: TurnkeyPrintDocumentType;

  /** 發票號碼或折讓單號 */
  @Column('varchar', { length: 16 })
  documentNumber: string;

  /** 第幾次列印，從 1 開始 */
  @Column('smallint')
  sequence: number;

  @Column('enum', { enum: TurnkeyProofFormat })
  format: TurnkeyProofFormat;

  /** 操作者（呼叫端自訂，例如帳號 id） */
  @Column('varchar', { nullable: true })
  operator: string | null;

  /** 呼叫端的 Idempotency-Key；同一個 key 重送沿用這筆，不再計一次列印 */
  @Column('varchar', { nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
