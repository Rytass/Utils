import type { BaseArticleEntity } from '../models/base-article.entity';
import type { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import type { BaseArticleVersionContentEntity } from '../models/base-article-version-content.entity';
import type { BaseCategoryEntity } from '../models/base-category.entity';
import type { BaseCategoryMultiLanguageNameEntity } from '../models/base-category-multi-language-name.entity';
import type { BaseSignatureLevelEntity } from '../models/base-signature-level.entity';
import type { CMSBaseModuleOptionsDto } from './cms-base-root-module-options.dto';

export interface CMSBaseModuleOptionFactory<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
  CategoryEntity extends BaseCategoryEntity = BaseCategoryEntity,
  CategoryMultiLanguageNameEntity extends BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
  SignatureLevelEntity extends BaseSignatureLevelEntity = BaseSignatureLevelEntity,
> {
  createCMSOptions():
    | Promise<
        CMSBaseModuleOptionsDto<
          ArticleEntity,
          ArticleVersionEntity,
          ArticleVersionContentEntity,
          CategoryEntity,
          CategoryMultiLanguageNameEntity,
          SignatureLevelEntity
        >
      >
    | CMSBaseModuleOptionsDto<
        ArticleEntity,
        ArticleVersionEntity,
        ArticleVersionContentEntity,
        CategoryEntity,
        CategoryMultiLanguageNameEntity,
        SignatureLevelEntity
      >;
}
