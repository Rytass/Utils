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
} from 'typeorm';
import { ArticleSignatureEntity } from './article-signature.entity';

export const BaseSignatureLevelRepo = Symbol('BaseSignatureLevelRepo');

@Entity('signature_levels')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class BaseSignatureLevelEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar')
  name: string;

  @Column('int', { default: 0 })
  @Index({ unique: true, where: '"deletedAt" IS NULL' })
  sequence: number;

  @Column('boolean', { default: true })
  required: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(
    () => ArticleSignatureEntity,
    (signature) => signature.signatureLevel,
  )
  signatures: Relation<ArticleSignatureEntity[]>;
}
