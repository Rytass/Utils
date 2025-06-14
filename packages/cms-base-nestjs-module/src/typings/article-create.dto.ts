import { BaseArticleVersionContentEntity } from '../models/base-article-version-content.entity';
import { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import { BaseArticleEntity } from '../models/base-article.entity';
import { Language } from './language';

type BaseArticleCreateDto<
  A extends BaseArticleEntity = BaseArticleEntity,
  AV extends BaseArticleVersionEntity = BaseArticleVersionEntity,
> = Partial<
  Omit<A, 'versions' | 'categories' | 'createdAt' | 'deletedAt' | 'id'> &
    Omit<
      AV,
      | 'articleId'
      | 'createdAt'
      | 'deletedAt'
      | 'article'
      | 'multiLanguageContents'
      | 'submittedAt'
      | 'submittedBy'
      | 'releasedBy'
      | 'signatures'
      | 'version'
    > & {
      categoryIds?: string[];
      submitted?: boolean;
      signatureLevel?: string | null;
      userId?: string | null;
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
