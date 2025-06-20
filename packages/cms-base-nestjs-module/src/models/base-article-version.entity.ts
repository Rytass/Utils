import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Relation,
  TableInheritance,
} from 'typeorm';
import { BaseArticleVersionContentEntity } from './base-article-version-content.entity';
import { BaseArticleEntity } from './base-article.entity';
import { ArticleSignatureEntity } from './base-article-signature.entity';

export const BaseArticleVersionRepo = Symbol('BaseArticleVersionRepo');

@Entity('article_versions')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class BaseArticleVersionEntity {
  @PrimaryColumn('uuid')
  @Index()
  articleId: string;

  @PrimaryColumn('int', { default: 0 })
  version: number;

  @Column('jsonb')
  tags: string[];

  @Column('timestamptz', { nullable: true })
  @Index()
  submittedAt: Date | null;

  @Column('uuid', { nullable: true })
  submittedBy: string | null;

  @Column('timestamptz', { nullable: true })
  @Index()
  releasedAt: Date | null;

  @Column('uuid', { nullable: true })
  releasedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column('uuid', { nullable: true })
  createdBy: string | null;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @ManyToOne(() => BaseArticleEntity, (article) => article.versions, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'articleId', referencedColumnName: 'id' })
  article: Relation<BaseArticleEntity>;

  @OneToMany(
    () => BaseArticleVersionContentEntity,
    (content) => content.articleVersion,
  )
  multiLanguageContents: Relation<BaseArticleVersionContentEntity[]>;

  @OneToMany(
    () => ArticleSignatureEntity,
    (signature) => signature.articleVersion,
  )
  signatures: Relation<ArticleSignatureEntity[]>;
}
