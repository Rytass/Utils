import { CategorySorter } from './category-sorter.enum';
import { Language } from './language';

export interface CategoryFindAllDto {
  ids?: string[] | null;
  language?: Language | null;
  fromTop?: boolean | null; // If true, return only top level categories
  sorter?: CategorySorter | null;
  offset?: number | null; // default: 0
  limit?: number | null; // default: 20, max: 100
  parentIds?: string[] | null;
}
