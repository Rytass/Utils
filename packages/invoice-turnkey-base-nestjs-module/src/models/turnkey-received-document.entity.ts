import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { TurnkeyMigMessageType } from '../typings/turnkey-enums';

export const TurnkeyReceivedDocumentRepo = Symbol('TurnkeyReceivedDocumentRepo');

export enum TurnkeyReceivedDocumentStatus {
  /** 收到，尚未回覆 */
  RECEIVED = 'RECEIVED',
  /** 已送確認（A0102、A0202、B0102、B0202） */
  CONFIRMED = 'CONFIRMED',
  /** 已送退回（A0301） */
  REJECTED = 'REJECTED',
  /** 賣方已確認我方的退回（A0302） */
  REJECTION_ACKNOWLEDGED = 'REJECTION_ACKNOWLEDGED',
}

/**
 * 我方為買方時收到的交換文件（A0101、A0201、A0302、B0101、B0201）
 * 發票號碼只在同一賣方、同一期別內唯一，跨期會重複，所以唯一鍵包含賣方統編與文件日期
 */
@Entity('turnkey_received_documents')
@Unique(['buyerTaxId', 'sellerTaxId', 'messageType', 'documentNumber', 'documentDate'])
@Index(['buyerTaxId', 'status', 'createdAt'])
export class TurnkeyReceivedDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 10 })
  buyerTaxId: string;

  @Column('varchar', { length: 10 })
  sellerTaxId: string;

  @Column('enum', { enum: TurnkeyMigMessageType })
  messageType: TurnkeyMigMessageType;

  @Column('varchar', { length: 16 })
  documentNumber: string;

  /** yyyyMMdd */
  @Column('varchar', { length: 8 })
  documentDate: string;

  @Column('timestamptz', { nullable: true })
  occurredAt: Date | null;

  @Column('varchar', { nullable: true })
  reason: string | null;

  @Column('enum', { enum: TurnkeyReceivedDocumentStatus, default: TurnkeyReceivedDocumentStatus.RECEIVED })
  status: TurnkeyReceivedDocumentStatus;

  @Column('text')
  xml: string;

  /** RecvTarget 裡的原始檔名 */
  @Column('varchar')
  fileName: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
