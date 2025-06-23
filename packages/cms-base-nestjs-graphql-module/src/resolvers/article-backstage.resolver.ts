import { Int, ResolveField, Resolver, Root } from '@nestjs/graphql';
import { ArticleBackstageDto } from '../dto/article-backstage.dto';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import type { SingleArticleBaseDto } from '@rytass/cms-base-nestjs-module';

@Resolver(() => ArticleBackstageDto)
export class ArticleBackstageResolver {
  @ResolveField(() => Int)
  @IsPublic()
  version(@Root() article: SingleArticleBaseDto): number {
    return article.version;
  }

  @ResolveField(() => Date, { nullable: true })
  @IsPublic()
  deletedAt(@Root() article: SingleArticleBaseDto): Date | null {
    return article.deletedAt ?? null;
  }
}
