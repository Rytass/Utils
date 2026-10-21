import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const TurnkeyEventRepo = Symbol('TurnkeyEventRepo');

@Entity('turnkey_events')
@Index(['companyTaxId', 'sequence'])
export class TurnkeyEventEntity {
  /** 遞增流水號；寫入前先取 advisory xact lock，流水號與 commit 順序一致 */
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  sequence: string;

  @Column('varchar')
  type: string;

  @Column('varchar', { length: 8 })
  companyTaxId: string;

  @Column('jsonb')
  data: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
