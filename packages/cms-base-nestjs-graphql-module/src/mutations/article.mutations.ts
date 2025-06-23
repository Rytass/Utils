import {
  ArticleBaseService,
  DEFAULT_LANGUAGE,
} from '@rytass/cms-base-nestjs-module';
import { Args, ID, Int, Mutation, Resolver } from '@nestjs/graphql';
import { BackstageArticleDto } from '../dto/backstage-article.dto';
import { CreateArticleArgs } from '../dto/create-article.args';
import { IsPublic, MemberId } from '@rytass/member-base-nestjs-module';
import { UpdateArticleArgs } from '../dto/update-article.args';

@Resolver()
export class ArticleMutations {
  constructor(private readonly articleService: ArticleBaseService) {}

  @Mutation(() => BackstageArticleDto)
  @IsPublic()
  async createArticle(
    @MemberId() memberId: string,
    @Args() args: CreateArticleArgs,
  ): Promise<BackstageArticleDto> {
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

  @Mutation(() => BackstageArticleDto)
  @IsPublic()
  async updateArticle(
    @MemberId() memberId: string,
    @Args() args: UpdateArticleArgs,
  ): Promise<BackstageArticleDto> {
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

  @Mutation(() => BackstageArticleDto)
  @IsPublic()
  async submitArticle(
    @MemberId() memberId: string,
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int }) version: number,
  ): Promise<BackstageArticleDto> {
    return this.articleService.submit(id, { version, userId: memberId });
  }

  @Mutation(() => BackstageArticleDto)
  @IsPublic()
  async approveArticle(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<BackstageArticleDto> {
    const article = await this.articleService.findById(id);

    return this.articleService.approveVersion(article);
  }

  @Mutation(() => BackstageArticleDto)
  @IsPublic()
  async rejectArticle(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { type: () => String, nullable: true })
    reason?: string | null,
  ): Promise<BackstageArticleDto> {
    const article = await this.articleService.findById(id);

    return this.articleService.rejectVersion(article, {
      reason,
    });
  }

  @Mutation(() => BackstageArticleDto)
  @IsPublic()
  releaseArticle(
    @MemberId() userId: string,
    @Args('id', { type: () => ID }) id: string,
    @Args('releasedAt', { type: () => Date }) releasedAt: Date,
  ): Promise<BackstageArticleDto> {
    return this.articleService.release(id, {
      releasedAt,
      userId,
    });
  }

  @Mutation(() => BackstageArticleDto)
  @IsPublic()
  withdrawArticle(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<BackstageArticleDto> {
    return this.articleService.withdraw(id);
  }
}
