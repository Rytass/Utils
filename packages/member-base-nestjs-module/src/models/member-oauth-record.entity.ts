import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
} from 'typeorm';
import { BaseMemberEntity } from './base-member.entity';

export const MemberOAuthRecordRepo = Symbol('MemberOAuthRecordRepo');

@Entity('member_oauth_records')
export class MemberOAuthRecordEntity {
  @PrimaryColumn('uuid')
  memberId: string;

  @PrimaryColumn('varchar')
  channel: string;

  @Column('varchar')
  channelIdentifier: string;

  @ManyToOne(() => BaseMemberEntity, (member) => member.oauthRecords)
  @JoinColumn({ name: 'memberId', referencedColumnName: 'id' })
  member: Relation<BaseMemberEntity>;
}
