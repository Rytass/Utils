import {
  BaseArticleEntity,
  BaseArticleVersionContentEntity,
  BaseArticleVersionEntity,
  BaseCategoryEntity,
  BaseCategoryMultiLanguageNameEntity,
} from '../models';

export interface CMSBaseRootModuleOptionsDto {
  multipleLanguageMode?: boolean; // default: false
  allowMultipleParentCategories?: boolean; // default: false
  allowCircularCategories?: boolean; // default: false
  articleEntity?: new () => BaseArticleEntity;
  articleVersionEntity?: new () => BaseArticleVersionEntity;
  articleVersionContentEntity?: new () => BaseArticleVersionContentEntity;
  categoryEntity?: new () => BaseCategoryEntity;
  categoryMultiLanguageNameEntity?: new () => BaseCategoryMultiLanguageNameEntity;
}
