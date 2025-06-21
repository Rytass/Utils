import { ResolveField, Resolver, Root } from '@nestjs/graphql';

import { Logger } from '@nestjs/common';
import {
  BaseArticleEntity,
  BaseArticleVersionEntity,
  BaseArticleVersionContentEntity,
  BaseCategoryEntity,
  ArticleStage,
  MultiLanguageArticleBaseDto,
} from '@rytass/cms-base-nestjs-module';
import {
  Article,
  ArticleSignature,
  BackstageArticle,
} from '../dto/article.dto';
import { CategoryDataLoader } from '../data-loaders/category.dataloader';
import { Category } from '../dto/category.dto';
import { ArticleDataLoader } from '../data-loaders/article.dataloader';
import { ArticleStageDataLoader } from '../data-loaders/article-stage.dataloader';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { MemberDataLoader } from '../data-loaders/members.dataloader';
import { User } from '../dto/user.dto';
import { Language } from '../decorators/language.decorator';

type ArticleDto = MultiLanguageArticleBaseDto<
  BaseArticleEntity,
  BaseArticleVersionEntity,
  BaseArticleVersionContentEntity
>;

function getId(article: any): string {
  if (article instanceof BaseArticleEntity) {
    return article.id;
  }

  return article.multiLanguageContents[0]?.articleId;
}

@Resolver(() => Article)
export class ArticleResolvers {
  constructor(
    private readonly categoryDataLoader: CategoryDataLoader,
    private readonly articleDataLoader: ArticleDataLoader,
    private readonly memberDataLoader: MemberDataLoader,
  ) {}

  Logger = new Logger(ArticleResolvers.name);

  @ResolveField(() => String)
  @IsPublic()
  id(@Root() article: ArticleDto): string {
    return getId(article);
  }

  @ResolveField(() => [String])
  @IsPublic()
  tags(@Root() article: ArticleDto): string[] {
    return article.tags ?? [];
  }

  @ResolveField(() => [Category])
  @IsPublic()
  async categories(@Root() article: ArticleDto): Promise<BaseCategoryEntity[]> {
    const id = getId(article);

    return id ? await this.categoryDataLoader.loaderWithArticleId.load(id) : [];
  }

  @ResolveField(() => String, { nullable: true })
  @IsPublic()
  title(
    @Root() article: ArticleDto,
    @Language() language: string,
  ): string | null {
    const content = article.multiLanguageContents.find(
      (c: { language: string }) => c.language === language,
    );

    return content?.title ?? null;
  }

  @ResolveField(() => String, { nullable: true })
  @IsPublic()
  content(
    @Root() article: ArticleDto,
    @Language() language: string,
  ): string | null {
    const content = article.multiLanguageContents.find(
      (c: { language: string }) => c.language === language,
    );

    return content?.content as unknown as string | null;
  }

  @ResolveField(() => Date)
  @IsPublic()
  async createdAt(@Root() article: ArticleDto): Promise<Date> {
    const id = getId(article);
    const articleEntity = await this.articleDataLoader.articleLoader.load(id);

    return articleEntity?.createdAt ?? new Date();
  }

  @ResolveField(() => Date)
  @IsPublic()
  async updatedAt(@Root() article: ArticleDto): Promise<Date> {
    const id = getId(article);
    const versionEntity = await this.articleDataLoader.versionLoader.load({
      id,
      version: article.version,
    });

    return versionEntity?.createdAt ?? new Date();
  }

  @ResolveField(() => User, { nullable: true })
  @IsPublic()
  async releasedBy(@Root() article: ArticleDto): Promise<User | null> {
    return article.releasedBy
      ? await this.memberDataLoader.loader.load(article.releasedBy)
      : null;
  }
}

@Resolver(() => BackstageArticle)
export class BackstageArticleResolvers {
  constructor(
    private readonly categoryDataLoader: CategoryDataLoader,
    private readonly articleDataLoader: ArticleDataLoader,
    private readonly articleStageDataLoader: ArticleStageDataLoader,
    private readonly memberDataLoader: MemberDataLoader,
  ) {}

  Logger = new Logger(BackstageArticleResolvers.name);

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  getId(article: any): string {
    if (article instanceof BaseArticleEntity) {
      return article.id;
    }

    return article.multiLanguageContents[0]?.articleId ?? '';
  }

  @ResolveField(() => String)
  @IsPublic()
  id(@Root() article: ArticleDto): string {
    console.log('article', article);

    return this.getId(article);
  }

  @ResolveField(() => [String])
  @IsPublic()
  tags(@Root() article: ArticleDto): string[] {
    return article.tags ?? [];
  }

  @ResolveField(() => [Category])
  @IsPublic()
  async categories(@Root() article: ArticleDto): Promise<BaseCategoryEntity[]> {
    const id = this.getId(article);

    return id ? await this.categoryDataLoader.loaderWithArticleId.load(id) : [];
  }

  @ResolveField(() => ArticleStage)
  @IsPublic()
  async stage(@Root() article: Article): Promise<ArticleStage> {
    const id = this.getId(article);

    return this.articleStageDataLoader.articleStageLoader.load(id);
  }

  @ResolveField(() => [ArticleSignature])
  @IsPublic()
  async signatures(@Root() article: ArticleDto): Promise<ArticleSignature[]> {
    const content = article.multiLanguageContents[0];

    if (!content) {
      return [];
    }

    const temp = await this.articleDataLoader.signatureLoader.load(
      content.articleId,
    );

    console.log('signatures', temp);

    return temp;
  }

  @ResolveField(() => Date)
  @IsPublic()
  async createdAt(@Root() article: ArticleDto): Promise<Date> {
    const id = getId(article);
    const articleEntity = await this.articleDataLoader.articleLoader.load(id);

    return articleEntity?.createdAt ?? new Date();
  }

  @ResolveField(() => Date)
  @IsPublic()
  async updatedAt(@Root() article: ArticleDto): Promise<Date> {
    const id = getId(article);
    const versionEntity = await this.articleDataLoader.versionLoader.load({
      id,
      version: article.version,
    });

    return versionEntity?.createdAt ?? new Date();
  }

  @ResolveField(() => User, { nullable: true })
  @IsPublic()
  async releasedBy(@Root() article: ArticleDto): Promise<User | null> {
    return article.releasedBy
      ? await this.memberDataLoader.loader.load(article.releasedBy)
      : null;
  }

  @ResolveField(() => User, { nullable: true })
  @IsPublic()
  async lastEditor(@Root() article: ArticleDto): Promise<User | null> {
    return article.createdBy
      ? await this.memberDataLoader.loader.load(article.createdBy)
      : null;
  }

  @ResolveField(() => Date)
  @IsPublic()
  async lastEditAt(@Root() article: ArticleDto): Promise<Date> {
    const id = getId(article);
    const versionEntity = await this.articleDataLoader.versionLoader.load({
      id,
      version: article.version,
    });

    return versionEntity?.createdAt ?? new Date();
  }

  @ResolveField(() => User, { nullable: true })
  @IsPublic()
  async submittedBy(@Root() article: ArticleDto): Promise<User | null> {
    return article.submittedBy
      ? await this.memberDataLoader.loader.load(article.submittedBy)
      : null;
  }
}
