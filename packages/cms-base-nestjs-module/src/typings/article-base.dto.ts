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
> = Omit<ArticleVersionContentEntity, 'id' | 'tags'> &
  Pick<ArticleVersionEntity, 'tags'> &
  ArticleEntity;

export type MultiLanguageArticleBaseDto<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends
    BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends
    BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> = Pick<ArticleVersionEntity, 'tags'> &
  ArticleEntity & {
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
