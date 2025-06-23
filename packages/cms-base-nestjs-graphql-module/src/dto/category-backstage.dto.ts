import { ObjectType } from '@nestjs/graphql';
import { BaseCategoryDto } from './base-category.dto';

@ObjectType('CategoryBackstage', {
  implements: () => [BaseCategoryDto],
})
export class CategoryBackstageDto extends BaseCategoryDto {}
