import { Field, ObjectType } from '@nestjs/graphql';
import { BaseCategoryDto } from './base-category.dto';

@ObjectType('Category')
export class CategoryDto extends BaseCategoryDto {
  @Field(() => String)
  name: string;
}
