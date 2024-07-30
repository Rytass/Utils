import {
  BaseArticleEntity,
  BaseArticleVersionContentEntity,
  BaseArticleVersionEntity,
  BaseCategoryEntity,
  BaseCategoryMultiLanguageNameEntity,
} from '../models';

export interface CMSBaseRootModuleOptionsDto {
  multipleLanguageMode?: boolean;
  articleEntity?: new () => BaseArticleEntity;
  articleVersionEntity?: new () => BaseArticleVersionEntity;
  articleVersionContentEntity?: new () => BaseArticleVersionContentEntity;
  categoryEntity?: new () => BaseCategoryEntity;
  categoryMultiLanguageNameEntity?: new () => BaseCategoryMultiLanguageNameEntity;
}
