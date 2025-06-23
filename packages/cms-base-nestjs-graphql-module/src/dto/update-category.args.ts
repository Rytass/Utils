import { ArgsType, Field, ID } from '@nestjs/graphql';
import { CreateCategoryArgs } from './create-category.args';

@ArgsType()
export class UpdateCategoryArgs extends CreateCategoryArgs {
  @Field(() => ID)
  id: string;
}
