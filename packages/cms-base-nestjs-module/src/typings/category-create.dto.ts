import { DeepPartial } from 'typeorm';
import { Language } from './language';
import { BaseCategoryEntity } from '../models/base-category.entity';

export type BaseCategoryCreateDto<
  C extends BaseCategoryEntity = BaseCategoryEntity,
> = DeepPartial<Omit<C, 'multiLanguageNames'>> & {
  bindable?: boolean | null; // default: true
  parentIds?: string[] | null;
  parentId?: string | null;
};

export type SingleLanguageCategoryCreateDto<
  C extends BaseCategoryEntity = BaseCategoryEntity,
> = BaseCategoryCreateDto<C> & {
  name: string;
};

export type MultiLanguageCategoryCreateDto<
  C extends BaseCategoryEntity = BaseCategoryEntity,
> = BaseCategoryCreateDto<C> & {
  multiLanguageNames: Record<Language, string>;
};

export type CategoryCreateDto<
  C extends BaseCategoryEntity = BaseCategoryEntity,
> = SingleLanguageCategoryCreateDto<C> | MultiLanguageCategoryCreateDto<C>;
