import { ArgsType, Field, ID, InputType } from '@nestjs/graphql';

@ArgsType()
export class CreateArticleArgs {
  @Field(() => [ID])
  categoryIds: string[];

  @Field(() => [String])
  tags: string[];

  @Field(() => [ArticleVersionContentInput])
  multiLanguageContents: ArticleVersionContentInput[];

  @Field(() => Date, { nullable: true })
  releasedAt?: Date | null;

  @Field(() => Boolean, { nullable: true })
  submitted?: boolean | null;

  @Field(() => String, { nullable: true })
  signatureLevel?: string | null;
}

@InputType()
export class ArticleVersionContentInput {
  @Field(() => String, { nullable: true })
  language?: string | null;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String)
  content: string;
}
