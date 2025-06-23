import { ArticleStage } from './article-stage.enum';

export type ArticleDefaultQueryBuilderDto = {
  signatureLevel?: string | null;
  stage?: ArticleStage | null; // Defaults: ArticleStage.RELEASED
  version?: number | null;
};
