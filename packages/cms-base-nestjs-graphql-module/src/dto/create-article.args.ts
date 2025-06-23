import { ArgsType, Field, ID } from '@nestjs/graphql';
import { ArticleVersionContentInput } from './article-version-content.input';

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
