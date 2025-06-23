import { ObjectType } from '@nestjs/graphql';
import { BaseCategoryDto } from './base-category.dto';

@ObjectType('BackstageCategory')
export class BackstageCategoryDto extends BaseCategoryDto {}
