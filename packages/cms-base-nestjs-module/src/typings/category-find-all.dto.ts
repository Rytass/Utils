import { CategorySorter } from './category-sorter.enum';
import { Language } from './language';

export interface CategoryFindAllDto {
  ids?: string[];
  language?: Language;
  fromTop?: boolean; // If true, return only top level categories
  sorter?: CategorySorter;
  offset?: number; // default: 0
  limit?: number; // default: 20, max: 100
  parentIds?: string[];
}
