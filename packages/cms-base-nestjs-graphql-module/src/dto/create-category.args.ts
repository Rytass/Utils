import { ArgsType, Field, ID } from '@nestjs/graphql';
import { CategoryMultiLanguageNameInput } from './category-multi-language-name.input';
import { CustomFieldInput } from './custom-field.input';

@ArgsType()
export class CreateCategoryArgs {
  @Field(() => [ID], { nullable: true })
  parentIds?: string[] | null;

  @Field(() => [CategoryMultiLanguageNameInput])
  multiLanguageNames: CategoryMultiLanguageNameInput[];

  @Field(() => [CustomFieldInput], { nullable: true })
  customFields?: CustomFieldInput[];
}
