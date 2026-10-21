import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, TableInheritance, UpdateDateColumn } from 'typeorm';

export const BaseTurnkeyCompanyRepo = Symbol('BaseTurnkeyCompanyRepo');

@Entity('turnkey_companies')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class BaseTurnkeyCompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 8, unique: true })
  taxId: string;

  @Column('varchar')
  name: string;

  @Column('varchar', { nullable: true })
  address: string | null;

  @Column('varchar', { length: 39, comment: 'Turnkey routing id (繞送代碼)' })
  routingId: string;

  @Column('boolean', { default: false, comment: 'can send B2B exchange invoices' })
  exchangeEnabled: boolean;

  @Column('timestamptz', { nullable: true })
  certificateExpiresAt: Date | null;

  @Column('text', { nullable: true, select: false, comment: 'QR code AES key, encrypted by secretEncryptionKey' })
  encryptedQrAesKey: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
