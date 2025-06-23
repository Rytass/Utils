import { ArgsType, Field, Int } from '@nestjs/graphql';

@ArgsType()
export class ArticlesArgs {
  @Field(() => [String], { nullable: true })
  categoryIds?: string[] | null;

  @Field(() => Int, { nullable: true })
  offset?: number | null;

  @Field(() => Int, { nullable: true })
  limit?: number | null;

  @Field(() => String, { nullable: true })
  searchTerm?: string | null;
}
