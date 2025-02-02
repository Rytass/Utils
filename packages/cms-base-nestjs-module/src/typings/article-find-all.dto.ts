import { ArticleSearchMode } from './article-search-mode.enum';
import { ArticleSorter } from './article-sorter.enum';
import { Language } from './language';

export interface ArticleFindAllDto {
  ids?: string[];
  categoryIds?: string[]; // Article must have at least one of these categories
  language?: Language;
  sorter?: ArticleSorter;
  offset?: number; // default: 0
  limit?: number; // default: 20, max: 100
  searchTerm?: string;
  searchMode?: ArticleSearchMode; // default ArticleSearchMode.TITLE
  onlyApproved?: boolean; // default: false
  requiredCategoryIds?: string[]; // Article must have all of these categories
}
