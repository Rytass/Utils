import { ArticleFindVersionType } from './article-find-version-type.enum';
import { Language } from './language';

export type ArticleFindByIdBaseDto = {
  onlyApproved?: boolean;
  language?: Language;
  versionType?: ArticleFindVersionType; // default: ArticleFindVersionType.RELEASED
};
