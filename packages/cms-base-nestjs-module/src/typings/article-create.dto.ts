import { Language } from './language';
import {
  BaseArticleEntity,
  BaseArticleVersionContentEntity,
  BaseArticleVersionEntity,
} from '../models';

type BaseArticleCreateDto<
  A extends BaseArticleEntity = BaseArticleEntity,
  AV extends BaseArticleVersionEntity = BaseArticleVersionEntity,
> = Partial<
  Omit<A, 'versions' | 'categories'> &
    Omit<
      AV,
      | 'articleId'
      | 'createdAt'
      | 'deletedAt'
      | 'article'
      | 'multiLanguageContents'
    > & {
      categoryIds?: string[];
    }
>;

export type SingleVersionContentCreateDto<
  AVC extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> = Partial<Omit<AVC, 'articleId' | 'version' | 'language' | 'articleVersion'>>;

export type SingleArticleCreateDto<
  A extends BaseArticleEntity = BaseArticleEntity,
  AV extends BaseArticleVersionEntity = BaseArticleVersionEntity,
  AVC extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> = BaseArticleCreateDto<A, AV> & SingleVersionContentCreateDto<AVC>;

export type MultiLanguageArticleCreateDto<
  A extends BaseArticleEntity = BaseArticleEntity,
  AV extends BaseArticleVersionEntity = BaseArticleVersionEntity,
  AVC extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> = BaseArticleCreateDto<A, AV> & {
  multiLanguageContents: Record<Language, SingleVersionContentCreateDto<AVC>>;
};
