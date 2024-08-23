import {
  BaseArticleEntity,
  BaseArticleVersionContentEntity,
  BaseArticleVersionEntity,
} from '../models';

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
    | 'createdAt'
    | 'deletedAt'
  > &
  Omit<ArticleEntity, 'versions'>;

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
