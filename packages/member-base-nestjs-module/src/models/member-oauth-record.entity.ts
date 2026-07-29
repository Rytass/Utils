import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { BaseMemberEntity } from './base-member.entity';

export const MemberOAuthRecordRepo = Symbol('MemberOAuthRecordRepo');

/**
 * Binding between a local member and an identity owned by an external channel
 * (an OAuth2 provider, an OIDC issuer, an LDAP directory, ...).
 *
 * The primary key keeps "one binding per member per channel"; the unique index
 * below adds the complementary guarantee that a given external identity can
 * only ever point at one member, and gives the reverse lookup
 * (channel + identifier -> member) an index to run on.
 */
@Entity('member_oauth_records')
@Index(['channel', 'channelIdentifier'], { unique: true })
export class MemberOAuthRecordEntity {
  @PrimaryColumn('uuid')
  @Index()
  memberId: string;

  @PrimaryColumn('varchar')
  channel: string;

  @Column('varchar')
  channelIdentifier: string;

  @ManyToOne(() => BaseMemberEntity, member => member.oauthRecords)
  @JoinColumn({ name: 'memberId', referencedColumnName: 'id' })
  member: Relation<BaseMemberEntity>;
}
