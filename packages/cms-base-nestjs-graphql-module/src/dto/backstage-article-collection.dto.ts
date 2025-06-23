import { Field, ObjectType } from '@nestjs/graphql';
import { Collection } from './collection.dto';
import { BackstageArticleDto } from './backstage-article.dto';

@ObjectType('BackstageArticleCollection')
export class BackstageArticleCollectionDto extends Collection {
  @Field(() => [BackstageArticleDto])
  articles: BackstageArticleDto[];
}
