import { BaseCategoryMultiLanguageNameEntity } from '../models/base-category-multi-language-name.entity';
import { BaseCategoryEntity } from '../models/base-category.entity';

type CategoryRootDto<
  C extends BaseCategoryEntity = BaseCategoryEntity,
  CM extends
    BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
> = Omit<C, 'parents' | 'children' | 'articles' | 'multiLanguageNames'> & {
  children: CategoryRootDto<C, CM>[];
  parents: CategoryRootDto<C, CM>[];
};

export type SingleCategoryBaseDto<
  C extends BaseCategoryEntity = BaseCategoryEntity,
  CM extends
    BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
> = CategoryRootDto<C, CM> &
  Omit<CM, 'category' | 'categoryId' | 'createdAt' | 'updatedAt'>;

export type MultiLanguageCategoryBaseDto<
  C extends BaseCategoryEntity = BaseCategoryEntity,
  CM extends
    BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
> = CategoryRootDto<C, CM> & {
  multiLanguageNames: Omit<CM, 'category'>[];
};

export type CategoryBaseDto<
  C extends BaseCategoryEntity = BaseCategoryEntity,
  CM extends
    BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
> = SingleCategoryBaseDto<C, CM> | MultiLanguageCategoryBaseDto<C, CM>;
