import { QuadratsElement } from '@quadrats/core';
import { Language } from './language';

interface BaseArticleCreateDto {
  tags?: string[];
}

interface SingleArticleCreateDto extends BaseArticleCreateDto {
  title: string;
  description?: string;
  content: QuadratsElement;
}

interface MultiLanguageArticleCreateDto extends BaseArticleCreateDto {
  multiLanguageContents: Record<Language, SingleArticleCreateDto>;
}

export type ArticleCreateDto =
  | SingleArticleCreateDto
  | MultiLanguageArticleCreateDto;
