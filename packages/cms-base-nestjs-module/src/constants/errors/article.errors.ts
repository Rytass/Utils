import { BadRequestException } from '@nestjs/common';

export class ArticleNotFoundError extends BadRequestException {
  constructor() {
    super('Article not found');
  }

  code = 200;
}

export class ArticleVersionNotFoundError extends BadRequestException {
  constructor() {
    super('Article version not found');
  }

  code = 201;
}
