import type { BaseArticleVersionContentEntity } from '../models/base-article-version-content.entity';
import type { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import type { BaseArticleEntity } from '../models/base-article.entity';
import type { BaseCategoryMultiLanguageNameEntity } from '../models/base-category-multi-language-name.entity';
import type { BaseCategoryEntity } from '../models/base-category.entity';
import type { BaseSignatureLevelEntity } from '../models/base-signature-level.entity';

export interface CMSBaseModuleOptionsDto<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
  CategoryEntity extends BaseCategoryEntity = BaseCategoryEntity,
  CategoryMultiLanguageNameEntity extends BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
  SignatureLevelEntity extends BaseSignatureLevelEntity = BaseSignatureLevelEntity,
> {
  multipleLanguageMode?: boolean; // default: false
  allowMultipleParentCategories?: boolean; // default: false
  allowCircularCategories?: boolean; // default: false
  fullTextSearchMode?: boolean; // default: false
  signatureLevels?: string[] | SignatureLevelEntity[];
  enableDraftMode?: boolean; // default: false
  autoReleaseWhenLatestSignatureApproved?: boolean; // default: false
  articleEntity?: new () => ArticleEntity;
  articleVersionEntity?: new () => ArticleVersionEntity;
  articleVersionContentEntity?: new () => ArticleVersionContentEntity;
  categoryEntity?: new () => CategoryEntity;
  categoryMultiLanguageNameEntity?: new () => CategoryMultiLanguageNameEntity;
  signatureLevelEntity?: new () => SignatureLevelEntity;
}
