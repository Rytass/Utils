import { ResolveField, Resolver, Root } from '@nestjs/graphql';
import { ArticleDto } from '../dto/article.dto';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { SingleArticleBaseDto } from '@rytass/cms-base-nestjs-module';
import { QuadratsContentScalar } from '../quadrats-element.scalar';
import { QuadratsElement } from '@quadrats/core';

@Resolver(() => ArticleDto)
export class ArticleResolver {
  @ResolveField(() => String)
  @IsPublic()
  title(@Root() article: SingleArticleBaseDto): string {
    return article.title;
  }

  @ResolveField(() => QuadratsContentScalar)
  @IsPublic()
  content(@Root() article: SingleArticleBaseDto): QuadratsElement[] {
    return article.content;
  }
}
