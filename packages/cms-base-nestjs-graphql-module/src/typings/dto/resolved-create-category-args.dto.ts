import { CustomFieldValue } from '../custom-field-value.type';

type BaseResolvedCreateCategoryArgsDto = {
  parentIds?: string[] | null;
  // Allow additional custom fields
  [key: string]: CustomFieldValue;
};

export type SingleLanguageResolvedCreateCategoryArgsDto = BaseResolvedCreateCategoryArgsDto & {
  name: string;
};

export type MultiLanguageResolvedCreateCategoryArgsDto = BaseResolvedCreateCategoryArgsDto & {
  multiLanguageNames: Record<string, string>;
};

export type ResolvedCreateCategoryArgsDto =
  | SingleLanguageResolvedCreateCategoryArgsDto
  | MultiLanguageResolvedCreateCategoryArgsDto;
