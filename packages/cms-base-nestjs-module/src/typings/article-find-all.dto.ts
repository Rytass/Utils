import { ArticleSorter } from './article-sorter.enum';
import { Language } from './language';

export interface ArticleFindAllDto {
  ids?: string[];
  categoryIds?: string[];
  language?: Language;
  sorter?: ArticleSorter;
  offset?: number; // default: 0
  limit?: number; // default: 20, max: 100
}
