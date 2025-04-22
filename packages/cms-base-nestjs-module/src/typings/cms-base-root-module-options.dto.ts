import { BaseArticleVersionContentEntity } from '../models/base-article-version-content.entity';
import { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import { BaseArticleEntity } from '../models/base-article.entity';
import { BaseCategoryMultiLanguageNameEntity } from '../models/base-category-multi-language-name.entity';
import { BaseCategoryEntity } from '../models/base-category.entity';
import { BaseSignatureLevelEntity } from '../models/base-signature-level.entity';

export interface CMSBaseModuleOptionsDto {
  multipleLanguageMode?: boolean; // default: false
  allowMultipleParentCategories?: boolean; // default: false
  allowCircularCategories?: boolean; // default: false
  fullTextSearchMode?: boolean; // default: false
  signatureMode?: boolean; // default: false
  signatureLevels?: string[] | BaseSignatureLevelEntity[];
  enableDraftMode?: boolean; // default: false
  autoReleaseWhenLatestSignatureApproved?: boolean; // default: false
  articleEntity?: new () => BaseArticleEntity;
  articleVersionEntity?: new () => BaseArticleVersionEntity;
  articleVersionContentEntity?: new () => BaseArticleVersionContentEntity;
  categoryEntity?: new () => BaseCategoryEntity;
  categoryMultiLanguageNameEntity?: new () => BaseCategoryMultiLanguageNameEntity;
  signatureLevelEntity?: new () => BaseSignatureLevelEntity;
}
