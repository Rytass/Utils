import { Field, InputType } from '@nestjs/graphql';

@InputType('ArticleVersionContentInput')
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
