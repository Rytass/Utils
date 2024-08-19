import { BadRequestException } from '@nestjs/common';

export class CategoryNotFoundError extends BadRequestException {
  constructor() {
    super('Category not found');
  }

  code = 300;
}

export class CircularCategoryNotAllowedError extends BadRequestException {
  constructor() {
    super('Circular category is not allowed');
  }

  code = 301;
}

export class MultipleParentCategoryNotAllowedError extends BadRequestException {
  constructor() {
    super(
      'Multiple parent categories not allowed, please enable on module forRoot options',
    );
  }

  code = 302;
}

export class ParentCategoryNotFoundError extends BadRequestException {
  constructor() {
    super('Parent category not found');
  }

  code = 303;
}
