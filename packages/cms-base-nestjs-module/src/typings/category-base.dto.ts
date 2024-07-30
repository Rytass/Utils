import {
  BaseCategoryEntity,
  BaseCategoryMultiLanguageNameEntity,
} from '../models';

export type SingleCategoryBaseDto = Pick<
  BaseCategoryEntity,
  'id' | 'bindable' | 'createdAt' | 'updatedAt' | 'deletedAt'
> &
  Pick<BaseCategoryMultiLanguageNameEntity, 'language' | 'name'> & {
    children: SingleCategoryBaseDto[];
  };

export type MultiLanguageCategoryBaseDto = Pick<
  BaseCategoryEntity,
  'id' | 'bindable' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & {
  multiLanguageNames: BaseCategoryMultiLanguageNameEntity[];
  children: MultiLanguageCategoryBaseDto[];
};

export type CategoryBaseDto =
  | SingleCategoryBaseDto
  | MultiLanguageCategoryBaseDto;
