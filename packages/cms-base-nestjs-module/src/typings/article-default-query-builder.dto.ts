import { ArticleStage } from './article-stage.enum';

export type ArticleDefaultQueryBuilderDto = {
  signatureLevel?: string;
  stage?: ArticleStage; // Defaults: ArticleStage.RELEASED
  version?: number;
};
