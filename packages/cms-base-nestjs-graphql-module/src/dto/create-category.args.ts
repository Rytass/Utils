import { ArgsType, Field, ID, InputType } from '@nestjs/graphql';

@ArgsType()
export class CreateCategoryArgs {
  @Field(() => [ID], { nullable: true })
  parentIds?: string[] | null;

  @Field(() => [CategoryMultiLanguageNameInput])
  multiLanguageNames: CategoryMultiLanguageNameInput[];
}

@InputType()
export class CategoryMultiLanguageNameInput {
  @Field(() => String, { nullable: true })
  language?: string | null;

  @Field(() => String)
  name: string;
}

@ArgsType()
export class UpdateCategoryArgs extends CreateCategoryArgs {
  @Field(() => ID)
  id: string;
}
