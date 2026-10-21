import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export const TurnkeyIdempotencyKeyRepo = Symbol('TurnkeyIdempotencyKeyRepo');

@Entity('turnkey_idempotency_keys')
@Unique(['companyTaxId', 'key'])
@Index(['createdAt'])
export class TurnkeyIdempotencyKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 8 })
  companyTaxId: string;

  @Column('varchar', { length: 255 })
  key: string;

  /** 請求內容（動作＋body）的 SHA-256，同 key 不同內容回 409 */
  @Column('varchar', { length: 64 })
  requestHash: string;

  /** 第一次處理完才有；null 表示處理中 */
  @Column('smallint', { nullable: true })
  responseStatus: number | null;

  @Column('jsonb', { nullable: true })
  responseBody: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
