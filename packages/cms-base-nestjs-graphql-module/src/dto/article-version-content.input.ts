import { Field, InputType } from '@nestjs/graphql';
import { QuadratsContentScalar } from '../scalars/quadrats-element.scalar';
import { QuadratsElement } from '@quadrats/core';

@InputType('ArticleVersionContentInput')
export class ArticleVersionContentInput {
  @Field(() => String, { nullable: true })
  language?: string | null;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => QuadratsContentScalar)
  content: QuadratsElement[];
}
