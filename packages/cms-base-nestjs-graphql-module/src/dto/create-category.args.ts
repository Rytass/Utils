import { ArgsType, Field, ID } from '@nestjs/graphql';
import { CategoryMultiLanguageNameInput } from './category-multi-language-name.input';

@ArgsType()
export class CreateCategoryArgs {
  @Field(() => [ID], { nullable: true })
  parentIds?: string[] | null;

  @Field(() => [CategoryMultiLanguageNameInput])
  multiLanguageNames: CategoryMultiLanguageNameInput[];
}
