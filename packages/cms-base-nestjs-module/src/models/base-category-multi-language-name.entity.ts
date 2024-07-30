import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import { BaseCategoryEntity } from './base-category.entity';
import { Language } from '../typings/language';
import { DEFAULT_LANGUAGE } from '../constant/default-language';

export const BaseCategoryMultiLanguageNameRepo = Symbol(
  'BaseCategoryMultiLanguageNameRepo',
);

@Entity('category_multi_language_names')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class BaseCategoryMultiLanguageNameEntity {
  @PrimaryColumn('uuid')
  categoryId: string;

  @PrimaryColumn('varchar', { default: DEFAULT_LANGUAGE })
  language: Language;

  @Column('varchar')
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(
    () => BaseCategoryEntity,
    (category) => category.multiLanguageNames,
    {
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      orphanedRowAction: 'delete',
    },
  )
  @JoinColumn({ name: 'categoryId', referencedColumnName: 'id' })
  category: Relation<BaseCategoryEntity>;
}
