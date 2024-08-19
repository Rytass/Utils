import {
  ArticleNotFoundError,
  ArticleVersionNotFoundError,
} from './article.errors';
import { MultipleLanguageModeIsDisabledError } from './base.errors';
import {
  CategoryNotFoundError,
  CircularCategoryNotAllowedError,
  MultipleParentCategoryNotAllowedError,
  ParentCategoryNotFoundError,
} from './category.errors';

export const Errors = {
  // Base
  MultipleLanguageModeIsDisabledError,

  // Articles
  ArticleNotFoundError,
  ArticleVersionNotFoundError,

  // Categories
  CategoryNotFoundError,
  CircularCategoryNotAllowedError,
  MultipleParentCategoryNotAllowedError,
  ParentCategoryNotFoundError,
};
