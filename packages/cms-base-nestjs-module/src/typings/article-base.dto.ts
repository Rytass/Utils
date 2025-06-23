import { BaseArticleVersionContentEntity } from '../models/base-article-version-content.entity';
import { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import { BaseArticleEntity } from '../models/base-article.entity';

export type SingleArticleBaseDto<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends
    BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends
    BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> = Omit<
  ArticleVersionContentEntity,
  | 'id'
  | 'articleId'
  | 'version'
  | 'searchTokens'
  | 'searchTokenVersion'
  | 'articleVersion'
> &
  Omit<
    ArticleVersionEntity,
    | 'articleId'
    | 'article'
    | 'multiLanguageContents'
    | 'signatures'
    | 'createdAt'
    | 'deletedAt'
  > &
  Omit<ArticleEntity, 'versions'> & {
    updatedAt: Date;
  };

export type MultiLanguageArticleBaseDto<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends
    BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends
    BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> = Omit<
  ArticleVersionEntity,
  'articleId' | 'article' | 'multiLanguageContents' | 'createdAt' | 'deletedAt'
> &
  Omit<ArticleEntity, 'versions'> & {
    updatedAt: Date;
    multiLanguageContents: ArticleVersionContentEntity[];
  };

export type ArticleBaseDto<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends
    BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends
    BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> =
  | SingleArticleBaseDto<
      ArticleEntity,
      ArticleVersionEntity,
      ArticleVersionContentEntity
    >
  | MultiLanguageArticleBaseDto<
      ArticleEntity,
      ArticleVersionEntity,
      ArticleVersionContentEntity
    >;
