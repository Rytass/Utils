import { ArticleSearchMode } from './article-search-mode.enum';
import { ArticleSorter } from './article-sorter.enum';
import { ArticleStage } from './article-stage.enum';
import { Language } from './language';

export interface ArticleFindAllDto {
  ids?: string[] | null;
  categoryIds?: string[] | null; // Article must have at least one of these categories
  language?: Language | null;
  sorter?: ArticleSorter | null;
  offset?: number | null; // default: 0
  limit?: number | null; // default: 20, max: 100
  searchTerm?: string | null;
  searchMode?: ArticleSearchMode | null; // default ArticleSearchMode.TITLE
  signatureLevel?: string | null; // return only articles with this signature level
  requiredCategoryIds?: string[] | null; // Article must have all of these categories
  stage?: ArticleStage | null;
}
