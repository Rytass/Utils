import { ArgsType, Field, ID } from '@nestjs/graphql';
import { CreateArticleArgs } from './create-article.args';

@ArgsType()
export class UpdateArticleArgs extends CreateArticleArgs {
  @Field(() => ID)
  id: string;
}
