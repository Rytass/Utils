import { QuadratsElement } from '@quadrats/core';
import { LanguageContents } from './language-contents';
import { Language } from '../language';

export interface CreateArticleOptions {
  title: string;
  categoryIds: string[];
  tags: string[];
  releasedAt?: Date | null;
  contents?: QuadratsElement[];
  language?: Language;

  // Multi-language article
  languageContents?: LanguageContents[];
}
