import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
  TableInheritance,
} from 'typeorm';
import { DEFAULT_LANGUAGE } from '../constants/default-language';
import { QuadratsElement } from '@quadrats/core';
import { BaseArticleVersionEntity } from './base-article-version.entity';
import { FULL_TEXT_SEARCH_TOKEN_VERSION } from '../constants/full-text-search-token-version';
import { EMPTY_QUADRATS_ELEMENTS } from '../constants/empty-quadrats-elements';

export const BaseArticleVersionContentRepo = Symbol(
  'BaseArticleVersionContentRepo',
);

@Entity('article_version_contents')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class BaseArticleVersionContentEntity {
  @PrimaryColumn('uuid')
  articleId: string;

  @PrimaryColumn('int', { default: 0 })
  version: number;

  @PrimaryColumn('varchar', { default: DEFAULT_LANGUAGE })
  language: string;

  @Column('varchar')
  @Index()
  title: string;

  @Column('varchar', { nullable: true, comment: 'Use for SEO' })
  @Index()
  description: string | null;

  @Column('json', { default: EMPTY_QUADRATS_ELEMENTS })
  content: QuadratsElement[];

  @Column('tsvector', { nullable: true, select: false })
  searchTokens: string | null;

  @Column('varchar', { default: FULL_TEXT_SEARCH_TOKEN_VERSION, select: false })
  searchTokenVersion: string;

  @ManyToOne(
    () => BaseArticleVersionEntity,
    (articleVersion) => articleVersion.multiLanguageContents,
    {
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      orphanedRowAction: 'delete',
    },
  )
  @JoinColumn([
    { name: 'articleId', referencedColumnName: 'articleId' },
    { name: 'version', referencedColumnName: 'version' },
  ])
  articleVersion: Relation<BaseArticleVersionEntity>;
}
