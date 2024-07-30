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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @ManyToMany(() => BaseCategoryEntity, (category) => category.children, {
    cascade: true,
  })
  @JoinTable({
    name: 'category_relations',
    joinColumn: { name: 'parentId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'childId', referencedColumnName: 'id' },
  })
  parents: Relation<BaseCategoryEntity[]>;

  @ManyToMany(() => BaseCategoryEntity, (category) => category.parents)
  children: Relation<BaseCategoryEntity[]>;

  @OneToMany(
    () => BaseCategoryMultiLanguageNameEntity,
    (multiLanguageName) => multiLanguageName.category,
  )
  multiLanguageNames: Relation<BaseCategoryMultiLanguageNameEntity[]>;

  @ManyToMany(() => BaseArticleEntity, (article) => article.categories)
  articles: Relation<BaseArticleEntity[]>;
}
