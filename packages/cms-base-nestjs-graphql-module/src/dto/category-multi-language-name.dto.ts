import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('CategoryMultiLanguageName')
export class CategoryMultiLanguageName {
  @Field(() => String)
  language: string;

  @Field(() => String)
  name: string;
}
