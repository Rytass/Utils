import { Language } from './language';

export type ArticleFindByIdBaseDto = {
  onlyApproved?: boolean;
  language?: Language;
};
