import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('BaseCategory')
export class BaseCategory {
  @Field(() => ID)
  id!: string;
}

@ObjectType('Category')
export class Category extends BaseCategory {}

@ObjectType('BackstageCategory')
export class BackstageCategory extends BaseCategory {}

@ObjectType('CategoryMultiLanguageName')
export class CategoryMultiLanguageName {
  @Field(() => String)
  language!: string;

  @Field(() => String)
  name!: string;
}
