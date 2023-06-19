import { QuadratsElement } from '@quadrats/core';
import { LanguageContents } from './language-contents';

export interface CreateArticleOptions {
  title: string;
  categoryIds: string[];
  tags: string[];
  releasedAt?: Date | null;
  contents?: QuadratsElement[];
  language?: string;

  // Multi-language article
  languageContents?: LanguageContents[];
}
