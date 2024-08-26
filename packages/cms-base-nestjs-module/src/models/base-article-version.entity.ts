import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Relation,
  TableInheritance,
} from 'typeorm';
import { BaseArticleVersionContentEntity } from './base-article-version-content.entity';
import { BaseArticleEntity } from './base-article.entity';

export const BaseArticleVersionRepo = Symbol('BaseArticleVersionRepo');

@Entity('article_versions')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class BaseArticleVersionEntity {
  @PrimaryColumn('uuid')
  articleId: string;

  @PrimaryColumn('int', { default: 0 })
  version: number;

  @Column('jsonb')
  tags: string[];

  @CreateDateColumn()
  createdAt: Date;

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
}
