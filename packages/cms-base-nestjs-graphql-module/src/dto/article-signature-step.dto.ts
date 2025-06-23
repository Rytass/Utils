import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('ArticleSignatureStep')
export class ArticleSignatureStepDto {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;
}
