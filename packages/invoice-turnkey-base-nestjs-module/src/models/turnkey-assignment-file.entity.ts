import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export const TurnkeyAssignmentFileRepo = Symbol('TurnkeyAssignmentFileRepo');

export enum TurnkeyAssignmentFileOutcome {
  /** 至少匯入一條字軌，或補上既有手動字軌的來源 */
  IMPORTED = 'IMPORTED',
  /** 所有區間都已由配號檔匯入過 */
  DUPLICATE = 'DUPLICATE',
  /** 有區間與既有字軌部分重疊，該區間未匯入（已發 invoice-track.import-conflict） */
  CONFLICT = 'CONFLICT',
  /** 內容無法解析或欄位格式錯誤 */
  INVALID = 'INVALID',
}

/** 已處理的 E0501 配號檔帳本：Unpack/BAK 是 Turnkey 的備份區，檔案不搬不刪，以此避免重複處理 */
@Entity('turnkey_assignment_files')
@Unique(['fileName'])
export class TurnkeyAssignmentFileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar')
  fileName: string;

  /** Turnkey 收到檔案的時間（檔案修改時間） */
  @Column('timestamptz')
  receivedAt: Date;

  @Column('varchar', { length: 20 })
  outcome: TurnkeyAssignmentFileOutcome;

  /** false：有區間的統編尚未登錄，之後的輪次會再處理這些區間 */
  @Column('boolean', { default: true })
  complete: boolean;

  /** 每個區間的處理結果 */
  @Column('jsonb')
  entries: Record<string, unknown>[];

  @CreateDateColumn({ type: 'timestamptz' })
  processedAt: Date;
}
