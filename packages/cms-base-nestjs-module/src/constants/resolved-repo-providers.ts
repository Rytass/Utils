import { Provider } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import {
  PROVIDE_ARTICLE_ENTITY,
  PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY,
  PROVIDE_ARTICLE_VERSION_ENTITY,
  PROVIDE_CATEGORY_ENTITY,
  PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY,
  PROVIDE_SIGNATURE_LEVEL_ENTITY,
  RESOLVED_ARTICLE_REPO,
  RESOLVED_ARTICLE_VERSION_CONTENT_REPO,
  RESOLVED_ARTICLE_VERSION_REPO,
  RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO,
  RESOLVED_CATEGORY_REPO,
  RESOLVED_SIGNATURE_LEVEL_REPO,
} from '../typings/cms-base-providers';
import { BaseArticleEntity, BaseArticleRepo } from '../models/base-article.entity';
import { BaseArticleVersionRepo } from '../models/base-article-version.entity';
import { BaseArticleVersionContentRepo } from '../models/base-article-version-content.entity';
import { BaseCategoryRepo } from '../models/base-category.entity';
import { BaseSignatureLevelRepo } from '../models/base-signature-level.entity';
import { BaseCategoryMultiLanguageNameRepo } from '../models/base-category-multi-language-name.entity';

export const TARGETS = [
  [BaseArticleRepo, PROVIDE_ARTICLE_ENTITY, RESOLVED_ARTICLE_REPO],
  [BaseArticleVersionRepo, PROVIDE_ARTICLE_VERSION_ENTITY, RESOLVED_ARTICLE_VERSION_REPO],
  [BaseArticleVersionContentRepo, PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY, RESOLVED_ARTICLE_VERSION_CONTENT_REPO],
  [BaseCategoryRepo, PROVIDE_CATEGORY_ENTITY, RESOLVED_CATEGORY_REPO],
  [
    BaseCategoryMultiLanguageNameRepo,
    PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY,
    RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO,
  ],
  [BaseSignatureLevelRepo, PROVIDE_SIGNATURE_LEVEL_ENTITY, RESOLVED_SIGNATURE_LEVEL_REPO],
];

export const ResolvedRepoProviders = TARGETS.map(([repo, provide, resolved]) => ({
  provide: resolved,
  useFactory: (
    baseRepo: Repository<typeof BaseArticleEntity>,
    entity: new () => BaseArticleEntity,
    dataSource: DataSource,
  ): Repository<any> => (entity ? dataSource.getRepository(entity) : baseRepo),
  inject: [repo, provide, DataSource],
})) as Provider[];
