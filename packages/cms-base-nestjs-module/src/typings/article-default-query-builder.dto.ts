import { ArticleFindVersionType } from './article-find-version-type.enum';

export type ArticleDefaultQueryBuilderDto = {
  versionType?: ArticleFindVersionType;
  onlyApproved?: boolean;
};
