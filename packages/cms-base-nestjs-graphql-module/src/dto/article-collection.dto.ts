import { Field, ObjectType } from '@nestjs/graphql';
import { BaseArticleDto } from './base-article.dto';
import { Collection } from './collection.dto';

@ObjectType('ArticleCollection')
export class ArticleCollectionDto extends Collection {
  @Field(() => [BaseArticleDto])
  articles: BaseArticleDto[];
}
