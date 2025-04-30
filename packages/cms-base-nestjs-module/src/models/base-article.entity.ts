import {
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  TableInheritance,
} from 'typeorm';
import { BaseArticleVersionEntity } from './base-article-version.entity';
import { BaseCategoryEntity } from './base-category.entity';

export const BaseArticleRepo = Symbol('BaseArticleRepo');

@Entity('articles')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class BaseArticleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn('timestamp with time zone')
  createdAt: Date;

  @DeleteDateColumn('timestamptz')
  deletedAt: Date | null;

  @OneToMany(
    () => BaseArticleVersionEntity,
    (articleVersion) => articleVersion.article,
  )
  versions: Relation<BaseArticleVersionEntity[]>;

  @ManyToMany(() => BaseCategoryEntity, (category) => category.articles)
  @JoinTable({
    name: 'article_categories',
    joinColumn: { name: 'articleId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories: Relation<BaseCategoryEntity[]>;
}
