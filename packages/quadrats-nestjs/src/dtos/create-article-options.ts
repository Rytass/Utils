import { QuadratsElement } from '@quadrats/core';

export interface CreateArticleOptions {
  title: string;
  categoryIds: string[];
  tags: string[];
  releasedAt?: Date | null;
  contents: QuadratsElement[];
}
