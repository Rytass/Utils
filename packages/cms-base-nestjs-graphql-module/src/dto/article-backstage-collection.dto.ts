import { Field, ObjectType } from '@nestjs/graphql';
import { Collection } from './collection.dto';
import { ArticleBackstageDto } from './article-backstage.dto';

@ObjectType('ArticleBackstageCollection')
export class ArticleBackstageCollectionDto extends Collection {
  @Field(() => [ArticleBackstageDto])
  articles: ArticleBackstageDto[];
}
