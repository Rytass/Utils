import { Field, ObjectType } from '@nestjs/graphql';
import { QuadratsContentScalar } from '../scalars/quadrats-element.scalar';
import type { QuadratsElement } from '@quadrats/core';

@ObjectType('ArticleMultiLanguageContent')
export class ArticleMultiLanguageContentDto {
  @Field(() => String)
  language: string;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => QuadratsContentScalar)
  content: QuadratsElement[];
}
