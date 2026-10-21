import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { TurnkeyAllowanceStatus, TurnkeyDeliveryMode } from '../typings/turnkey-enums';
import { TurnkeyAllowanceItemEntity } from './turnkey-allowance-item.entity';

export const TurnkeyAllowanceRepo = Symbol('TurnkeyAllowanceRepo');

@Entity('turnkey_allowances')
@Unique(['companyTaxId', 'allowanceNumber'])
@Unique(['companyTaxId', 'externalId'])
export class TurnkeyAllowanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 8 })
  companyTaxId: string;

  @Column('varchar', { length: 16 })
  allowanceNumber: string;

  @Column('varchar', { nullable: true })
  externalId: string | null;

  /** 原發票號碼（一張折讓只對一張發票） */
  @Column('varchar', { length: 10 })
  invoiceNumber: string;

  @Column('enum', { enum: TurnkeyDeliveryMode })
  deliveryMode: TurnkeyDeliveryMode;

  @Column('enum', { enum: TurnkeyAllowanceStatus, default: TurnkeyAllowanceStatus.SUBMITTED })
  status: TurnkeyAllowanceStatus;

  @Column('timestamptz')
  allowanceDate: Date;

  @Column('varchar', { length: 10 })
  buyerTaxId: string;

  /** 未稅金額合計（MIG TotalAmount） */
  @Column('integer')
  totalAmount: number;

  @Column('integer')
  taxAmount: number;

  @Column('timestamptz', { nullable: true })
  voidedAt: Date | null;

  @Column('varchar', { nullable: true })
  voidReason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => TurnkeyAllowanceItemEntity, item => item.allowance, { cascade: ['insert'] })
  items: Relation<TurnkeyAllowanceItemEntity[]>;
}
