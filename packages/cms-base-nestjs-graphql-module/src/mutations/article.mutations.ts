import { Args, ID, Int, Mutation, Resolver } from '@nestjs/graphql';
import { ArticleBaseService } from '@rytass/cms-base-nestjs-module';
import { BackstageArticle } from '../dto/article.dto';
import {
  CreateArticleArgs,
  UpdateArticleArgs,
} from '../dto/create-article.args';
import { IsPublic, MemberId } from '@rytass/member-base-nestjs-module';

@Resolver()
export class ArticleMutations {
  constructor(private readonly articleService: ArticleBaseService) {}

  @Mutation(() => BackstageArticle)
  @IsPublic()
  async createArticle(
    @MemberId() memberId: string,
    @Args() args: CreateArticleArgs,
  ): Promise<BackstageArticle> {
    return this.articleService.create({ ...args, userId: memberId });
  }

  @Mutation(() => BackstageArticle)
  @IsPublic()
  async updateArticle(
    @MemberId() memberId: string,
    @Args() args: UpdateArticleArgs,
  ): Promise<BackstageArticle> {
    return this.articleService.addVersion(args.id, {
      ...args,
      userId: memberId,
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

  @Mutation(() => BackstageArticle)
  @IsPublic()
  async submitArticle(
    @MemberId() memberId: string,
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int }) version: number,
  ): Promise<BackstageArticle> {
    return this.articleService.submit(id, { version, userId: memberId });
  }

  @Mutation(() => BackstageArticle)
  @IsPublic()
  async approveArticle(
    @MemberId() memberId: string,
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int }) version: number,
    @Args('signatureLevel', { type: () => String }) signatureLevel: string,
  ): Promise<BackstageArticle> {
    return this.articleService.approveVersion(
      { id, version },
      { signatureLevel, signerId: memberId },
    );
  }

  @Mutation(() => BackstageArticle)
  @IsPublic()
  async rejectArticle(
    @MemberId() memberId: string,
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int }) version: number,
    @Args('signatureLevel', { type: () => String }) signatureLevel: string,
    @Args('reason', { type: () => String, nullable: true })
    reason?: string | null,
  ): Promise<BackstageArticle> {
    return this.articleService.rejectVersion(
      { id, version },
      { signatureLevel, signerId: memberId, reason },
    );
  }

  @Mutation(() => BackstageArticle)
  @IsPublic()
  releaseArticle(
    @MemberId() memberId: string,
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int }) version: number,
    @Args('releasedAt', { type: () => Date }) releasedAt: Date,
  ): Promise<BackstageArticle> {
    return this.articleService.release(id, {
      releasedAt,
      version,
      // userId: memberId,
    });
  }

  @Mutation(() => BackstageArticle)
  @IsPublic()
  withdrawArticle(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<BackstageArticle> {
    return this.articleService.withdraw(id);
  }
}
