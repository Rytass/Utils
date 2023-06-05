import { QuadratsArticleCategory } from './quadrats-article-category';
import { QuadratsArticleContentItem } from './quadrats-article-content-item';

export interface QuadratsArticle {
  id: string;
  versionId: string;
  title: string;
  categories: QuadratsArticleCategory[];
  tags: string[];
  releasedAt: Date | null;
  contents: QuadratsArticleContentItem[];
}
