import {
  ArticleNotIncludeFields,
  ArticleVersionContentNotIncludeFields,
  ArticleVersionNotIncludeFields,
} from '../constants/not-include-entity-fields';
import { BaseArticleVersionContentEntity } from '../models/base-article-version-content.entity';
import { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import { BaseArticleEntity } from '../models/base-article.entity';

type RemovedArticleFields = 'versions' | 'categories';
type RemovedArticleVersionFields =
  | RemovedArticleFields
  | 'articleId'
  | 'article'
  | 'multiLanguageContents'
  | 'signatures';
type RemovedMultipleLanguageArticleVersionFields =
  | RemovedArticleFields
  | 'articleId'
  | 'article'
  | 'signatures';
type RemovedArticleVersionContentFields =
  | RemovedArticleVersionFields
  | 'version'
  | 'language'
  | 'articleVersion';

export function removeArticleInvalidFields<
  A extends Partial<BaseArticleEntity> = Partial<BaseArticleEntity>,
>(article: Partial<A>): Omit<A, RemovedArticleFields> {
  return Object.entries(article)
    .filter(([key]) => !~ArticleNotIncludeFields.indexOf(key))
    .reduce<Omit<A, RemovedArticleFields>>(
      (vars, [key, value]) => ({
        ...vars,
        [key]: value,
      }),
      {} as Omit<A, RemovedArticleFields>,
    );
}

export function removeMultipleLanguageArticleVersionInvalidFields<
  AV extends BaseArticleVersionEntity = BaseArticleVersionEntity,
>(
  articleVersion: Partial<
    Pick<
      AV,
      | 'version'
      | 'tags'
      | 'submittedAt'
      | 'submittedBy'
      | 'releasedAt'
      | 'releasedBy'
      | 'createdAt'
      | 'deletedAt'
    >
  >,
): Omit<AV, RemovedMultipleLanguageArticleVersionFields> {
  return Object.entries(articleVersion)
    .filter(
      ([key]) =>
        !ArticleVersionNotIncludeFields.includes(key) ||
        key === 'multiLanguageContents',
    )
    .reduce<Record<string, any>>(
      (vars, [key, value]) => ({
        ...vars,
        [key]: value,
      }),
      {},
    ) as Omit<AV, RemovedMultipleLanguageArticleVersionFields>;
}

export function removeArticleVersionInvalidFields<
  AV extends BaseArticleVersionEntity = BaseArticleVersionEntity,
>(
  articleVersion: Partial<
    Pick<
      AV,
      | 'version'
      | 'tags'
      | 'submittedAt'
      | 'submittedBy'
      | 'releasedAt'
      | 'releasedBy'
      | 'createdAt'
      | 'deletedAt'
    >
  >,
): Omit<AV, RemovedArticleVersionFields> {
  return Object.entries(articleVersion)
    .filter(([key]) => !ArticleVersionNotIncludeFields.includes(key))
    .reduce<Record<string, any>>(
      (vars, [key, value]) => ({
        ...vars,
        [key]: value,
      }),
      {},
    ) as Omit<AV, RemovedArticleVersionFields>;
}

export function removeArticleVersionContentInvalidFields<
  AVC extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
>(
  articleVersionContent: Partial<
    Pick<AVC, 'title' | 'description' | 'content'>
  >,
): Omit<AVC, RemovedArticleVersionContentFields> {
  return Object.entries(articleVersionContent)
    .filter(([key]) => !~ArticleVersionContentNotIncludeFields.indexOf(key))
    .reduce<Omit<AVC, RemovedArticleVersionContentFields>>(
      (vars, [key, value]) => ({
        ...vars,
        [key]: value,
      }),
      {} as Omit<AVC, RemovedArticleVersionContentFields>,
    );
}
