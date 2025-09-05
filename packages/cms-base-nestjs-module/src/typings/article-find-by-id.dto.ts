import { ArticleStage } from './article-stage.enum';
import { Language } from './language';

export type ArticleFindByIdBaseDto = {
  language?: Language | null;
  stage?: ArticleStage | null; // if not provided, return latest version
  version?: number | null;
};
