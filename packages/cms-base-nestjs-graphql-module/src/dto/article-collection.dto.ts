import { Field, ObjectType } from '@nestjs/graphql';
import { Collection } from './collection.dto';
import { ArticleDto } from './article.dto';

@ObjectType('ArticleCollection')
export class ArticleCollectionDto extends Collection {
  @Field(() => [ArticleDto])
  articles: ArticleDto[];
}
