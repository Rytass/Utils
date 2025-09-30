import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import { MemberLoginLogEntity } from './member-login-log.entity';
import { MemberPasswordHistoryEntity } from './member-password-history.entity';
import { MemberOAuthRecordEntity } from './member-oauth-record.entity';

export const BaseMemberRepo = Symbol('BaseMemberRepo');

@Entity('members')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
@Index(['account'], { unique: true, where: '"deletedAt" IS NULL' })
export class BaseMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar')
  account: string;

  @Column('varchar')
  password: string;

  @Column('timestamptz', { default: 'now()' })
  passwordChangedAt: Date;

  @Column('timestamptz', { nullable: true })
  resetPasswordRequestedAt: Date | null;

  @Column('int2', { default: 0 })
  loginFailedCounter: number;

  @Column('boolean', {
    default: false,
    comment: 'Member should update password before login',
  })
  shouldUpdatePassword: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(() => MemberLoginLogEntity, log => log.member)
  loginLogs: Relation<MemberLoginLogEntity[]>;

  @OneToMany(() => MemberPasswordHistoryEntity, history => history.member)
  passwordHistories: Relation<MemberPasswordHistoryEntity[]>;

  @OneToMany(() => MemberOAuthRecordEntity, record => record.member)
  oauthRecords: Relation<MemberOAuthRecordEntity[]>;
}
