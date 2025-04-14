import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { BaseArticleVersionEntity } from './base-article-version.entity';
import { ArticleSignatureResult } from '../typings/article-signature-result.enum';
import { BaseSignatureLevelEntity } from './base-signature-level.entity';

export const ArticleSignatureRepo = Symbol('ArticleSignatureRepo');

@Entity('article_signatures')
@Index(
  'article_signature_article_id_version',
  ['articleId', 'version', 'signatureLevelId'],
  { unique: true, where: '"deletedAt" IS NULL' },
)
@Index(['articleId', 'version'])
export class ArticleSignatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  articleId: string;

  @Column('int')
  version: number;

  @Column('uuid', { nullable: true })
  @Index()
  signatureLevelId: string | null;

  @Column('enum', {
    enum: ArticleSignatureResult,
    default: ArticleSignatureResult.APPROVED,
  })
  result: ArticleSignatureResult;

  @Column('varchar', { nullable: true })
  rejectReason: string | null;

  @Column('uuid', { nullable: true })
  signerId: string | null;

  @CreateDateColumn()
  signedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @ManyToOne(() => BaseArticleVersionEntity, (version) => version.signatures)
  @JoinColumn([
    { name: 'articleId', referencedColumnName: 'articleId' },
    { name: 'version', referencedColumnName: 'version' },
  ])
  articleVersion: Relation<BaseArticleVersionEntity>;

  @ManyToOne(() => BaseSignatureLevelEntity, (level) => level.signatures, {
    nullable: true,
  })
  @JoinColumn({ name: 'signatureLevelId', referencedColumnName: 'id' })
  signatureLevel: Relation<BaseSignatureLevelEntity> | null;
}
