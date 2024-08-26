import { QuadratsElement } from '@quadrats/core';
import { Language } from './language';
import {
  BaseArticleEntity,
  BaseArticleVersionContentEntity,
  BaseArticleVersionEntity,
} from '../models';
import { DeepPartial } from 'typeorm';

type BaseArticleCreateDto<
  A extends BaseArticleEntity = BaseArticleEntity,
  AV extends BaseArticleVersionEntity = BaseArticleVersionEntity,
> = Omit<A, 'versions' | 'categories'> &
  Omit<
    AV,
    | 'articleId'
    | 'createdAt'
    | 'deletedAt'
    | 'article'
    | 'multiLanguageContents'
  > & {
    categoryIds?: string[];
  };

export type SingleVersionContentCreateDto<
  AVC extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> = Omit<AVC, 'articleId' | 'version' | 'language' | 'articleVersion'>;

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

export type ArticleCreateDto<
  A extends BaseArticleEntity = BaseArticleEntity,
  AV extends BaseArticleVersionEntity = BaseArticleVersionEntity,
  AVC extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> =
  | SingleArticleCreateDto<A, AV, AVC>
  | MultiLanguageArticleCreateDto<A, AV, AVC>;
