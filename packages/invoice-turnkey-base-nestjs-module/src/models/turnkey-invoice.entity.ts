import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  TableInheritance,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  TurnkeyCarrierType,
  TurnkeyCustomsClearance,
  TurnkeyDeliveryMode,
  TurnkeyInvoiceStatus,
  TurnkeyTaxType,
} from '../typings/turnkey-enums';
import { numericTransformer } from '../utils/numeric-transformer';
import { TurnkeyInvoiceItemEntity } from './turnkey-invoice-item.entity';

export const BaseTurnkeyInvoiceRepo = Symbol('BaseTurnkeyInvoiceRepo');

@Entity('turnkey_invoices')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
@Unique(['companyTaxId', 'invoiceNumber'])
@Unique(['companyTaxId', 'externalId'])
export class BaseTurnkeyInvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 8 })
  companyTaxId: string;

  @Column('varchar', { length: 10 })
  invoiceNumber: string;

  @Column('varchar', { nullable: true })
  externalId: string | null;

  @Column('enum', { enum: TurnkeyDeliveryMode })
  deliveryMode: TurnkeyDeliveryMode;

  @Column('enum', { enum: TurnkeyInvoiceStatus, default: TurnkeyInvoiceStatus.SUBMITTED })
  status: TurnkeyInvoiceStatus;

  @Column('timestamptz')
  issuedAt: Date;

  @Column('varchar', { length: 10, comment: '0000000000 for consumers' })
  buyerTaxId: string;

  @Column('varchar')
  buyerName: string;

  @Column('varchar', { nullable: true })
  buyerAddress: string | null;

  @Column('enum', { enum: TurnkeyTaxType })
  taxType: TurnkeyTaxType;

  @Column('numeric', { precision: 6, scale: 4, transformer: numericTransformer })
  taxRate: number;

  @Column('integer')
  salesAmount: number;

  @Column('integer', { default: 0 })
  taxFreeSalesAmount: number;

  @Column('integer', { default: 0 })
  zeroRatedSalesAmount: number;

  @Column('integer')
  taxAmount: number;

  @Column('integer')
  totalAmount: number;

  @Column('enum', { enum: TurnkeyCarrierType, nullable: true })
  carrierType: TurnkeyCarrierType | null;

  @Column('varchar', { nullable: true })
  carrierCode: string | null;

  @Column('varchar', { nullable: true })
  carrierHiddenCode: string | null;

  @Column('varchar', { nullable: true })
  carrierTypeCode: string | null;

  @Column('varchar', { length: 7, nullable: true })
  npoCode: string | null;

  @Column('boolean')
  printed: boolean;

  @Column('varchar', { length: 4, nullable: true })
  randomNumber: string | null;

  @Column('varchar', { length: 2, nullable: true })
  zeroRatedReasonCode: string | null;

  @Column('enum', { enum: TurnkeyCustomsClearance, nullable: true })
  customsClearance: TurnkeyCustomsClearance | null;

  @Column('varchar', { nullable: true })
  mainRemark: string | null;

  @Column('timestamptz', { nullable: true })
  voidedAt: Date | null;

  /** 交換發票：買方確認（A0102）時間 */
  @Column('timestamptz', { nullable: true })
  confirmedAt: Date | null;

  /** 交換發票：買方退回（A0301）時間；送 A0302 時要原樣照抄 */
  @Column('timestamptz', { nullable: true })
  rejectedAt: Date | null;

  @Column('varchar', { nullable: true })
  rejectReason: string | null;

  @Column('varchar', { nullable: true })
  voidReason: string | null;

  /** 存證發票註銷（F0701）時間；平台收下後狀態為 ANNULLED */
  @Column('timestamptz', { nullable: true })
  annulledAt: Date | null;

  @Column('varchar', { nullable: true })
  annulReason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => TurnkeyInvoiceItemEntity, item => item.invoice, { cascade: ['insert'] })
  items: Relation<TurnkeyInvoiceItemEntity[]>;
}
