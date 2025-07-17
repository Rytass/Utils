import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('CategoryMultiLanguageName')
export class CategoryMultiLanguageNameDto {
  @Field(() => String)
  language: string;

  @Field(() => String)
  name: string;
}
