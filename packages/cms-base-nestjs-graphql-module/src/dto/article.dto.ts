import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Collection } from './collection.dto';

@ObjectType('BaseArticle')
export class BaseArticle {
  @Field(() => ID)
  id!: string;

  @Field(() => Date, { nullable: true })
  releasedAt?: Date | null;
}

@ObjectType('Article')
export class Article extends BaseArticle {}

@ObjectType('BackstageArticle')
export class BackstageArticle extends BaseArticle {
  @Field(() => Int)
  version!: number;

  @Field(() => Date, { nullable: true })
  submittedAt?: Date | null;

  @Field(() => [ArticleVersionContent])
  multiLanguageContents!: ArticleVersionContent[];
}

@ObjectType('ArticleMultiLanguageName')
export class ArticleMultiLanguageName {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  language!: string;

  @Field(() => String)
  name!: string;
}

@ObjectType('ArticleVersionContent')
export class ArticleVersionContent {
  @Field(() => String)
  language!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  content?: string | null;
}

@ObjectType('ArticleCollection')
export class ArticleCollection extends Collection {
  @Field(() => [Article])
  articles!: Article[];
}

@ObjectType('BackstageArticleCollection')
export class BackstageArticleCollection extends Collection {
  @Field(() => [BackstageArticle])
  articles!: BackstageArticle[];
}

@ObjectType('ArticleSignature')
export class ArticleSignature {
  @Field(() => ID)
  id!: string;

  @Field(() => Date)
  signedAt!: Date;

  @Field(() => String, { nullable: true })
  rejectReason?: string | null;
}
