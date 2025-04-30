import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import { BaseCategoryMultiLanguageNameEntity } from './base-category-multi-language-name.entity';
import { BaseArticleEntity } from './base-article.entity';

export const BaseCategoryRepo = Symbol('BaseCategoryRepo');

@Entity('categories')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class BaseCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('boolean', { default: false, comment: 'is article bindable' })
  bindable: boolean;

  @CreateDateColumn('timestamp with time zone')
  createdAt: Date;

  @UpdateDateColumn('timestamptz')
  updatedAt: Date;

  @DeleteDateColumn('timestamptz')
  deletedAt: Date | null;

  @ManyToMany(() => BaseCategoryEntity, (category) => category.children)
  @JoinTable({
    name: 'category_relations',
    joinColumn: { name: 'childId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'parentId', referencedColumnName: 'id' },
  })
  parents: Relation<BaseCategoryEntity[]>;

  @ManyToMany(() => BaseCategoryEntity, (category) => category.parents, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  children: Relation<BaseCategoryEntity[]>;

  @OneToMany(
    () => BaseCategoryMultiLanguageNameEntity,
    (multiLanguageName) => multiLanguageName.category,
  )
  multiLanguageNames: Relation<BaseCategoryMultiLanguageNameEntity[]>;

  @ManyToMany(() => BaseArticleEntity, (article) => article.categories, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  articles: Relation<BaseArticleEntity[]>;
}
