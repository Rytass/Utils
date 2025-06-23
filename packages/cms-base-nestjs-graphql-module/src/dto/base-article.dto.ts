import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('BaseArticle')
export class BaseArticleDto {
  @Field(() => ID)
  id: string;

  @Field(() => [String])
  tags: string[];

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => Date, { nullable: true })
  releasedAt: Date | null;
}
