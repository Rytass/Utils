import {
  ArticleBaseService,
  DEFAULT_LANGUAGE,
  MULTIPLE_LANGUAGE_MODE,
} from '@rytass/cms-base-nestjs-module';
import { Args, ID, Int, Mutation, Resolver } from '@nestjs/graphql';
import { BackstageArticleDto } from '../dto/backstage-article.dto';
import { CreateArticleArgs } from '../dto/create-article.args';
import { IsPublic, MemberId } from '@rytass/member-base-nestjs-module';
import { UpdateArticleArgs } from '../dto/update-article.args';
import { Inject } from '@nestjs/common';

@Resolver()
export class ArticleMutations {
  constructor(
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multiLanguage: boolean,
    private readonly articleService: ArticleBaseService,
  ) {}

  private resolveCreateArticleArgs(args: CreateArticleArgs) {
    const basePayload = {
      categoryIds: args.categoryIds,
      tags: args.tags,
      submitted: args.submitted ?? undefined,
      signatureLevel: args.signatureLevel ?? null,
      releasedAt: args.releasedAt ?? null,
    };

    if (!this.multiLanguage) {
      const [content] = args.multiLanguageContents;

      return {
        ...basePayload,
        title: content.title,
        content: content.content,
        description: content.description ?? undefined,
      };
    }

    const multiLanguageContents = args.multiLanguageContents.reduce(
      (vars, content) => ({
        ...vars,
        [content.language ?? DEFAULT_LANGUAGE]: {
          title: content.title,
          description: content.description,
          content: content.content,
        },
      }),
      {},
    );

    return {
      ...basePayload,
      multiLanguageContents,
    };
  }

  @Mutation(() => BackstageArticleDto)
  @IsPublic()
  async createArticle(
    @MemberId() memberId: string,
    @Args() args: CreateArticleArgs,
  ): Promise<BackstageArticleDto> {
    console.log(this.resolveCreateArticleArgs(args));

    return this.articleService.create({
      ...this.resolveCreateArticleArgs(args),
      userId: memberId,
    });
  }

  @Mutation(() => BackstageArticleDto)
  @IsPublic()
  async updateArticle(
    @MemberId() memberId: string,
    @Args() args: UpdateArticleArgs,
  ): Promise<BackstageArticleDto> {
    return this.articleService.addVersion(args.id, {
      ...this.resolveCreateArticleArgs(args),
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

  @Mutation(() => Boolean)
  @IsPublic()
  async deleteArticleVersion(
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int }) version: number,
  ): Promise<boolean> {
    await this.articleService.deleteVersion(id, version);

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
    @Args('version', { type: () => Int, nullable: true })
    version?: number | null,
  ): Promise<BackstageArticleDto> {
    const article = await this.articleService.findById(id);

    return this.articleService.approveVersion({
      id,
      version: version ?? article.version,
    });
  }

  @Mutation(() => BackstageArticleDto)
  @IsPublic()
  async rejectArticle(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { type: () => String, nullable: true })
    reason?: string | null,
    @Args('version', { type: () => Int, nullable: true })
    version?: number | null,
  ): Promise<BackstageArticleDto> {
    const article = await this.articleService.findById(id);

    return this.articleService.rejectVersion(
      {
        id,
        version: version ?? article.version,
      },
      {
        reason,
      },
    );
  }

  @Mutation(() => BackstageArticleDto)
  @IsPublic()
  releaseArticle(
    @MemberId() userId: string,
    @Args('id', { type: () => ID }) id: string,
    @Args('releasedAt', { type: () => Date }) releasedAt: Date,
    @Args('version', { type: () => Int, nullable: true })
    version?: number | null,
  ): Promise<BackstageArticleDto> {
    return this.articleService.release(id, {
      releasedAt,
      userId,
      version: version ?? undefined,
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
