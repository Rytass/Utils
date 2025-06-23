import {
  ArticleBaseService,
  DEFAULT_LANGUAGE,
} from '@rytass/cms-base-nestjs-module';
import { Args, ID, Int, Mutation, Resolver } from '@nestjs/graphql';
import { ArticleBackstageDto } from '../dto/article-backstage.dto';
import { CreateArticleArgs } from '../dto/create-article.args';
import { IsPublic, MemberId } from '@rytass/member-base-nestjs-module';
import { UpdateArticleArgs } from '../dto/update-article.args';

@Resolver()
export class ArticleMutations {
  constructor(private readonly articleService: ArticleBaseService) {}

  @Mutation(() => ArticleBackstageDto)
  @IsPublic()
  async createArticle(
    @MemberId() memberId: string,
    @Args() args: CreateArticleArgs,
  ): Promise<ArticleBackstageDto> {
    return this.articleService.create({
      categoryIds: args.categoryIds,
      tags: args.tags,
      multiLanguageContents: args.multiLanguageContents.reduce(
        (vars, content) => ({
          ...vars,
          [content.language ?? DEFAULT_LANGUAGE]: {
            title: content.title,
            description: content.description,
            content: content.content,
          },
        }),
        {},
      ),
      userId: memberId,
      submitted: args.submitted ?? undefined,
      signatureLevel: args.signatureLevel ?? null,
      releasedAt: args.releasedAt ?? null,
    });
  }

  @Mutation(() => ArticleBackstageDto)
  @IsPublic()
  async updateArticle(
    @MemberId() memberId: string,
    @Args() args: UpdateArticleArgs,
  ): Promise<ArticleBackstageDto> {
    return this.articleService.addVersion(args.id, {
      categoryIds: args.categoryIds,
      tags: args.tags,
      multiLanguageContents: args.multiLanguageContents.reduce(
        (vars, content) => ({
          ...vars,
          [content.language ?? DEFAULT_LANGUAGE]: {
            title: content.title,
            description: content.description,
            content: content.content,
          },
        }),
        {},
      ),
      userId: memberId,
      submitted: args.submitted ?? undefined,
      signatureLevel: args.signatureLevel ?? null,
      releasedAt: args.releasedAt ?? null,
    });
  }

  @Mutation(() => Boolean)
  @IsPublic()
  async deleteArticle(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.articleService.archive(id);

    return true;
  }

  @Mutation(() => ArticleBackstageDto)
  @IsPublic()
  async submitArticle(
    @MemberId() memberId: string,
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int }) version: number,
  ): Promise<ArticleBackstageDto> {
    return this.articleService.submit(id, { version, userId: memberId });
  }

  @Mutation(() => ArticleBackstageDto)
  @IsPublic()
  async approveArticle(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ArticleBackstageDto> {
    const article = await this.articleService.findById(id);

    return this.articleService.approveVersion(article);
  }

  @Mutation(() => ArticleBackstageDto)
  @IsPublic()
  async rejectArticle(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { type: () => String, nullable: true })
    reason?: string | null,
  ): Promise<ArticleBackstageDto> {
    const article = await this.articleService.findById(id);

    return this.articleService.rejectVersion(article, {
      reason,
    });
  }

  @Mutation(() => ArticleBackstageDto)
  @IsPublic()
  releaseArticle(
    @MemberId() userId: string,
    @Args('id', { type: () => ID }) id: string,
    @Args('releasedAt', { type: () => Date }) releasedAt: Date,
  ): Promise<ArticleBackstageDto> {
    return this.articleService.release(id, {
      releasedAt,
      userId,
    });
  }

  @Mutation(() => ArticleBackstageDto)
  @IsPublic()
  withdrawArticle(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ArticleBackstageDto> {
    return this.articleService.withdraw(id);
  }
}
