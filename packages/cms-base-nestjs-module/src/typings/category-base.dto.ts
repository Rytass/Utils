import { BaseCategoryMultiLanguageNameEntity } from '../models/base-category-multi-language-name.entity';
import { BaseCategoryEntity } from '../models/base-category.entity';

export type SingleCategoryBaseDto<
  CategoryEntity extends BaseCategoryEntity = BaseCategoryEntity,
  CategoryMultiLanguageNameEntity extends
    BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
> = Pick<
  CategoryEntity,
  'id' | 'bindable' | 'createdAt' | 'updatedAt' | 'deletedAt'
> &
  Pick<CategoryMultiLanguageNameEntity, 'language' | 'name'> & {
    children: SingleCategoryBaseDto[];
  };

export type MultiLanguageCategoryBaseDto<
  CategoryEntity extends BaseCategoryEntity = BaseCategoryEntity,
  CategoryMultiLanguageNameEntity extends
    BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
> = Pick<
  CategoryEntity,
  'id' | 'bindable' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & {
  multiLanguageNames: CategoryMultiLanguageNameEntity[];
  children: MultiLanguageCategoryBaseDto[];
};

export type CategoryBaseDto<
  CategoryEntity extends BaseCategoryEntity = BaseCategoryEntity,
  CategoryMultiLanguageNameEntity extends
    BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
> =
  | SingleCategoryBaseDto<CategoryEntity, CategoryMultiLanguageNameEntity>
  | MultiLanguageCategoryBaseDto<
      CategoryEntity,
      CategoryMultiLanguageNameEntity
    >;
