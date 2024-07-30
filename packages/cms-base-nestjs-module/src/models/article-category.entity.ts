import { Entity, PrimaryColumn } from 'typeorm';

export const ArticleCategoryRepo = Symbol('ArticleCategoryRepo');

@Entity('article_categories')
export class ArticleCategoryEntity {
  @PrimaryColumn('uuid')
  articleId: string;

  @PrimaryColumn('uuid')
  categoryId: string;
}
