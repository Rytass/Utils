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
> = Pick<
  ArticleVersionContentEntity,
  'version' | 'language' | 'title' | 'description' | 'content'
> &
  Pick<ArticleVersionEntity, 'tags'> &
  Pick<ArticleEntity, 'id'>;

export type MultiLanguageArticleBaseDto<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends
    BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends
    BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> = Pick<ArticleVersionEntity, 'tags'> &
  Pick<ArticleEntity, 'id'> & {
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
