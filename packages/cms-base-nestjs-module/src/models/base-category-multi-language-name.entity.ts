import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import { BaseCategoryEntity } from './base-category.entity';
import { Language } from '../typings/language';
import { DEFAULT_LANGUAGE } from '../constants/default-language';

export const BaseCategoryMultiLanguageNameRepo = Symbol(
  'BaseCategoryMultiLanguageNameRepo',
);

@Entity('category_multi_language_names')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class BaseCategoryMultiLanguageNameEntity {
  @PrimaryColumn('uuid')
  @Index()
  categoryId: string;

  @PrimaryColumn('varchar', { default: DEFAULT_LANGUAGE })
  language: Language;

  @Column('varchar')
  name: string;

  @CreateDateColumn('timestamp with time zone')
  createdAt: Date;

  @UpdateDateColumn('timestamptz')
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
