import {
  BaseArticleEntity,
  BaseArticleVersionContentEntity,
  BaseArticleVersionEntity,
} from '../models';

export type SingleArticleBaseDto = Pick<
  BaseArticleVersionContentEntity,
  'version' | 'language' | 'title' | 'description' | 'content'
> &
  Pick<BaseArticleVersionEntity, 'tags'> &
  Pick<BaseArticleEntity, 'id'>;

export type MultiLanguageArticleBaseDto = Pick<
  BaseArticleVersionEntity,
  'tags'
> &
  Pick<BaseArticleEntity, 'id'> & {
    multiLanguageContents: BaseArticleVersionContentEntity[];
  };

export type ArticleBaseDto = SingleArticleBaseDto | MultiLanguageArticleBaseDto;
