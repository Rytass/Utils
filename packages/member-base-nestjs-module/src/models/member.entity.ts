import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { MemberLoginLogEntity } from './member-login-log.entity';

export const MemberRepo = Symbol('MemberRepo');

@Entity('members')
@Index(['account'], { unique: true, where: '"deletedAt" IS NULL' })
export class MemberEntity {
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(() => MemberLoginLogEntity, (log) => log.member)
  loginLogs: Relation<MemberLoginLogEntity[]>;
}
