import { ArgsType, Field } from '@nestjs/graphql';

@ArgsType()
export class CategoriesArgs {
  @Field(() => [String], { nullable: true })
  parentIds?: string[] | null;

  @Field(() => [String], { nullable: true })
  ids?: string[] | null;

  @Field(() => String, { nullable: true })
  searchTerm?: string | null;
}
