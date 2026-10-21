import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const TurnkeyEventCursorRepo = Symbol('TurnkeyEventCursorRepo');

@Entity('turnkey_event_cursors')
export class TurnkeyEventCursorEntity {
  @PrimaryColumn('varchar')
  channel: string;

  @Column('bigint', { default: '0' })
  lastSequence: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
