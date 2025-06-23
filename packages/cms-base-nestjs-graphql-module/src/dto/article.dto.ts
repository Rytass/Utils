import { Field, ObjectType } from '@nestjs/graphql';
import { BaseArticleDto } from './base-article.dto';
import { QuadratsContentScalar } from '../quadrats-element.scalar';
import type { QuadratsElement } from '@quadrats/core';

@ObjectType('Article')
export class ArticleDto extends BaseArticleDto {
  @Field(() => String)
  title: string;

  @Field(() => QuadratsContentScalar)
  content: QuadratsElement[];
}
