import { QuadratsElement } from '@quadrats/core';
import { Language } from './language';
import { BaseArticleEntity } from '../models';
import { DeepPartial } from 'typeorm';

type BaseArticleCreateDto<A extends BaseArticleEntity = BaseArticleEntity> =
  DeepPartial<A> & {
    tags?: string[];
    categoryIds?: string[];
  };

type SingleArticleCreateDto<A extends BaseArticleEntity = BaseArticleEntity> =
  BaseArticleCreateDto<A> & {
    title: string;
    description?: string;
    content: QuadratsElement[];
  };

type MultiLanguageArticleCreateDto<
  A extends BaseArticleEntity = BaseArticleEntity,
> = BaseArticleCreateDto<A> & {
  multiLanguageContents: Record<Language, SingleArticleCreateDto>;
};

export type ArticleCreateDto<A extends BaseArticleEntity = BaseArticleEntity> =
  | SingleArticleCreateDto<A>
  | MultiLanguageArticleCreateDto<A>;
