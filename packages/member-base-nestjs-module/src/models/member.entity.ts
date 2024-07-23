import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const MemberRepo = Symbol('MemberRepo');

@Entity('members')
export class MemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { unique: true })
  account: string;

  @Column('varchar')
  password: string;

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
}
