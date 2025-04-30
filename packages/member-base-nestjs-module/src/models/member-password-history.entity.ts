import { BaseMemberEntity } from './base-member.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';

export const MemberPasswordHistoryRepo = Symbol('MemberPasswordHistoryRepo');

@Entity('member_password_histories')
export class MemberPasswordHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  memberId: string;

  @Column('varchar')
  password: string;

  @CreateDateColumn('timestamp with time zone')
  createdAt: Date;

  @ManyToOne(() => BaseMemberEntity, (member) => member.passwordHistories)
  @JoinColumn({ name: 'memberId', referencedColumnName: 'id' })
  member: Relation<BaseMemberEntity>;
}
