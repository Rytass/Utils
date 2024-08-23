import { ArticleSearchMode } from './article-search-mode.enum';
import { ArticleSorter } from './article-sorter.enum';
import { Language } from './language';

export interface ArticleFindAllDto {
  ids?: string[];
  categoryIds?: string[];
  language?: Language;
  sorter?: ArticleSorter;
  offset?: number; // default: 0
  limit?: number; // default: 20, max: 100
  searchTerm?: string;
  searchMode?: ArticleSearchMode; // default ArticleSearchMode.TITLE
}
