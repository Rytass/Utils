import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import { MemberLoginLogEntity } from './member-login-log.entity';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(() => MemberLoginLogEntity, (log) => log.member)
  loginLogs: Relation<MemberLoginLogEntity[]>;
}
