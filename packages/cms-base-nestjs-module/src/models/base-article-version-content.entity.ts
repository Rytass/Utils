import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
  TableInheritance,
} from 'typeorm';
import { DEFAULT_LANGUAGE } from '../constant/default-language';
import { QuadratsElement } from '@quadrats/core';
import { BaseArticleVersionEntity } from './base-article-version.entity';

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
  title: string;

  @Column('varchar', { nullable: true, comment: 'Use for SEO' })
  description: string | null;

  @Column('json')
  content: QuadratsElement;

  @ManyToOne(
    () => BaseArticleVersionEntity,
    (articleVersion) => articleVersion.multiLanguageContents,
  )
  @JoinColumn([
    { name: 'articleId', referencedColumnName: 'articleId' },
    { name: 'version', referencedColumnName: 'version' },
  ])
  articleVersion: Relation<BaseArticleVersionEntity>;
}
