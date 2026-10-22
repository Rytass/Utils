import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TurnkeyMessageCategory, TurnkeyMigMessageType, TurnkeySubmissionStatus } from '../typings/turnkey-enums';

export const TurnkeySubmissionRepo = Symbol('TurnkeySubmissionRepo');

@Entity('turnkey_submissions')
@Index(['status', 'createdAt'])
@Index(['companyTaxId', 'documentNumber', 'createdAt'])
export class TurnkeySubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 8 })
  companyTaxId: string;

  @Column('enum', { enum: TurnkeyMigMessageType })
  messageType: TurnkeyMigMessageType;

  @Column('enum', { enum: TurnkeyMessageCategory })
  category: TurnkeyMessageCategory;

  /** 發票號碼、折讓單號或 E0402 的期別字軌 */
  @Column('varchar')
  documentNumber: string;

  /** UpCast 裡的檔名（<submission id>.xml），寫檔前就決定 */
  @Column('varchar', { unique: true })
  fileName: string;

  @Column('text')
  xml: string;

  @Column('enum', { enum: TurnkeySubmissionStatus, default: TurnkeySubmissionStatus.PENDING })
  status: TurnkeySubmissionStatus;

  @Column('varchar', { nullable: true, comment: 'turnkey_message_log.uuid' })
  turnkeyUuid: string | null;

  /** 00000、E1002、7001 這類代碼 */
  @Column('varchar', { nullable: true })
  resultCode: string | null;

  @Column('text', { nullable: true })
  resultMessage: string | null;

  /** 前一次送件（重送時） */
  @Column('uuid', { nullable: true })
  previousSubmissionId: string | null;

  @Column('timestamptz', { nullable: true })
  writtenAt: Date | null;

  @Column('timestamptz', { nullable: true })
  resolvedAt: Date | null;

  /** 已發出 submission.stalled 的時間；每筆只通知一次 */
  @Column('timestamptz', { nullable: true })
  stalledNotifiedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
