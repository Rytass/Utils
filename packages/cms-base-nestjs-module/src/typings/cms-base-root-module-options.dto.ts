import {
  BaseArticleEntity,
  BaseArticleVersionContentEntity,
  BaseArticleVersionEntity,
  BaseCategoryEntity,
  BaseCategoryMultiLanguageNameEntity,
} from '../models';

export interface CMSBaseModuleOptionsDto {
  multipleLanguageMode?: boolean; // default: false
  allowMultipleParentCategories?: boolean; // default: false
  allowCircularCategories?: boolean; // default: false
  fullTextSearchMode?: boolean; // default: false
  articleEntity?: new () => BaseArticleEntity;
  articleVersionEntity?: new () => BaseArticleVersionEntity;
  articleVersionContentEntity?: new () => BaseArticleVersionContentEntity;
  categoryEntity?: new () => BaseCategoryEntity;
  categoryMultiLanguageNameEntity?: new () => BaseCategoryMultiLanguageNameEntity;
}
