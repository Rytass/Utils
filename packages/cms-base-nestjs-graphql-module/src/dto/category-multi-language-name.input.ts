import { ArgsType, Field, ID, InputType } from '@nestjs/graphql';

@InputType('CategoryMultiLanguageNameInput')
export class CategoryMultiLanguageNameInput {
  @Field(() => String, { nullable: true })
  language?: string | null;

  @Field(() => String)
  name: string;
}
