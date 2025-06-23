import { ObjectType } from '@nestjs/graphql';
import { BaseCategoryDto } from './base-category.dto';

@ObjectType('CategoryBackstage')
export class CategoryBackstageDto extends BaseCategoryDto {}
