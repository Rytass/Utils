import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { BaseMemberEntity } from './base-member.entity';

export const MemberLoginLogRepo = Symbol('MemberLoginLogRepo');

@Entity('member_login_logs')
export class MemberLoginLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  memberId: string;

  @Column('boolean', { default: true })
  success: boolean;

  @Column('cidr', { nullable: true })
  ip: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => BaseMemberEntity, (member) => member.loginLogs)
  @JoinColumn({ name: 'memberId', referencedColumnName: 'id' })
  member: Relation<BaseMemberEntity>;
}
