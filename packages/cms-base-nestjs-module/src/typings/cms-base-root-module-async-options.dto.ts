import type { ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import type { BaseArticleEntity } from '../models/base-article.entity';
import type { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import type { BaseArticleVersionContentEntity } from '../models/base-article-version-content.entity';
import type { BaseCategoryEntity } from '../models/base-category.entity';
import type { BaseCategoryMultiLanguageNameEntity } from '../models/base-category-multi-language-name.entity';
import type { BaseSignatureLevelEntity } from '../models/base-signature-level.entity';
import type { CMSBaseModuleOptionsDto } from './cms-base-root-module-options.dto';
import type { CMSBaseModuleOptionFactory } from './cms-base-root-module-option-factory';
import type { DependencyInjectionToken, FactoryFunctionArgs } from './module-factory.type';

export interface CMSBaseModuleAsyncOptionsDto<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
  CategoryEntity extends BaseCategoryEntity = BaseCategoryEntity,
  CategoryMultiLanguageNameEntity extends BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
  SignatureLevelEntity extends BaseSignatureLevelEntity = BaseSignatureLevelEntity,
> extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: FactoryFunctionArgs
  ) =>
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
  inject?: readonly (DependencyInjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<
    CMSBaseModuleOptionFactory<
      ArticleEntity,
      ArticleVersionEntity,
      ArticleVersionContentEntity,
      CategoryEntity,
      CategoryMultiLanguageNameEntity,
      SignatureLevelEntity
    >
  >;
  useExisting?: Type<
    CMSBaseModuleOptionFactory<
      ArticleEntity,
      ArticleVersionEntity,
      ArticleVersionContentEntity,
      CategoryEntity,
      CategoryMultiLanguageNameEntity,
      SignatureLevelEntity
    >
  >;
}
