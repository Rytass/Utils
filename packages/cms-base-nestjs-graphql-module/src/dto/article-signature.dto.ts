import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ArticleSignatureResult } from '@rytass/cms-base-nestjs-module';

@ObjectType('ArticleSignature')
export class ArticleSignatureDto {
  @Field(() => ID)
  id: string;

  @Field(() => Date)
  signedAt: Date;

  @Field(() => ArticleSignatureResult)
  result: ArticleSignatureResult;

  @Field(() => String, { nullable: true })
  rejectReason: string | null;
}

registerEnumType(ArticleSignatureResult, {
  name: 'ArticleSignatureResult',
});
