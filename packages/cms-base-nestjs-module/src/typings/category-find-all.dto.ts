import { Language } from './language';

export interface CategoryFindAllDto {
  ids?: string[];
  language?: Language;
  fromTop?: boolean; // If true, return only top level categories
}
