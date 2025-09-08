import { ArticleBaseService, DEFAULT_LANGUAGE, MULTIPLE_LANGUAGE_MODE } from '@rytass/cms-base-nestjs-module';
import { Args, ID, Int, Mutation, Resolver } from '@nestjs/graphql';
import { BackstageArticleDto } from '../dto/backstage-article.dto';
import { CreateArticleArgs } from '../dto/create-article.args';
import { AllowActions, MemberId } from '@rytass/member-base-nestjs-module';
import { UpdateArticleArgs } from '../dto/update-article.args';
import { Inject } from '@nestjs/common';
import { BaseAction } from '../constants/enum/base-action.enum';
import { BaseResource } from '../constants/enum/base-resource.enum';
import { MAP_ARTICLE_CUSTOM_FIELDS_TO_ENTITY_COLUMNS } from '../typings/cms-graphql-base-providers';
import { CustomFieldInput } from '../dto/custom-field.input';
import { ResolvedCreateArticleArgsDto } from '../typings/dto/resolved-create-article-args.dto';

@Resolver()
export class ArticleMutations {
  constructor(
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multiLanguage: boolean,
    @Inject(MAP_ARTICLE_CUSTOM_FIELDS_TO_ENTITY_COLUMNS)
    private readonly mapArticleCustomFieldsToEntityColumns: (
      customFields: CustomFieldInput[],
    ) => Promise<Record<string, string>>,
    private readonly articleService: ArticleBaseService,
  ) {}

  private async resolveCreateArticleArgs(args: CreateArticleArgs): Promise<ResolvedCreateArticleArgsDto> {
    const extraArgsInput: Record<string, string | object> = {};

    if (args.customFields?.length) {
      Object.assign(extraArgsInput, await this.mapArticleCustomFieldsToEntityColumns(args.customFields));
    }

    const basePayload = {
      categoryIds: args.categoryIds,
      tags: args.tags,
      submitted: args.submitted ?? undefined,
      signatureLevel: args.signatureLevel ?? null,
      releasedAt: args.releasedAt ?? null,
      ...extraArgsInput,
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
  @AllowActions([[BaseResource.ARTICLE, BaseAction.CREATE]])
  async createArticle(@MemberId() memberId: string, @Args() args: CreateArticleArgs): Promise<BackstageArticleDto> {
    return this.articleService.create({
      ...(await this.resolveCreateArticleArgs(args)),
      userId: memberId,
    });
  }

  @Mutation(() => BackstageArticleDto)
  @AllowActions([[BaseResource.ARTICLE, BaseAction.UPDATE]])
  async updateArticle(@MemberId() memberId: string, @Args() args: UpdateArticleArgs): Promise<BackstageArticleDto> {
    return this.articleService.addVersion(args.id, {
      ...(await this.resolveCreateArticleArgs(args)),
      userId: memberId,
    });
  }

  @Mutation(() => Boolean)
  @AllowActions([[BaseResource.ARTICLE, BaseAction.DELETE]])
  async deleteArticle(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    await this.articleService.archive(id);

    return true;
  }

  @Mutation(() => Boolean)
  @AllowActions([[BaseResource.ARTICLE, BaseAction.DELETE_VERSION]])
  async deleteArticleVersion(
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int }) version: number,
  ): Promise<boolean> {
    await this.articleService.deleteVersion(id, version);

    return true;
  }

  @Mutation(() => BackstageArticleDto)
  @AllowActions([[BaseResource.ARTICLE, BaseAction.SUBMIT]])
  async submitArticle(
    @MemberId() memberId: string,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<BackstageArticleDto> {
    return this.articleService.submit(id, {
      userId: memberId,
    });
  }

  @Mutation(() => BackstageArticleDto)
  @AllowActions([[BaseResource.ARTICLE, BaseAction.PUT_BACK]])
  async putBackArticle(
    @MemberId() _memberId: string,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<BackstageArticleDto> {
    return this.articleService.putBack(id);
  }

  @Mutation(() => BackstageArticleDto)
  @AllowActions([[BaseResource.ARTICLE, BaseAction.APPROVE]])
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
  @AllowActions([[BaseResource.ARTICLE, BaseAction.REJECT]])
  async rejectArticle(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { type: () => String, nullable: true })
    reason?: string | null,
  ): Promise<BackstageArticleDto> {
    return this.articleService.rejectVersion({ id }, { reason });
  }

  @Mutation(() => BackstageArticleDto)
  @AllowActions([[BaseResource.ARTICLE, BaseAction.RELEASE]])
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
  @AllowActions([[BaseResource.ARTICLE, BaseAction.WITHDRAW]])
  withdrawArticle(
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int }) version: number,
  ): Promise<BackstageArticleDto> {
    return this.articleService.withdraw(id, version);
  }
}
