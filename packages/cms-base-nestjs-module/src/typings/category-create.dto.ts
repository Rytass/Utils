import { Language } from './language';

interface BaseCategoryCreateDto {
  bindable?: boolean; // default: true
  parentIds?: string[];
  parentId?: string;
}

export interface SingleLanguageCategoryCreateDto extends BaseCategoryCreateDto {
  name: string;
}

export interface MultiLanguageCategoryCreateDto extends BaseCategoryCreateDto {
  multiLanguageNames: Record<Language, string>;
}

export type CategoryCreateDto =
  | SingleLanguageCategoryCreateDto
  | MultiLanguageCategoryCreateDto;
