import { ID, ResolveField, Resolver, Root } from '@nestjs/graphql';
import { MemberDataLoader } from '../data-loaders/members.dataloader';
import { UserDto } from '../dto/user.dto';
import { Authenticated } from '@rytass/member-base-nestjs-module';
import {
  ArticleSignatureDataLoader,
  ArticleStage,
  ArticleVersionDataLoader,
  DEFAULT_LANGUAGE,
  MULTIPLE_LANGUAGE_MODE,
  ArticleDataLoader as ModuleArticleDataLoader,
  type ArticleBaseDto,
} from '@rytass/cms-base-nestjs-module';
import { CategoryDto } from '../dto/category.dto';
import { ArticleDataLoader } from '../data-loaders/article.dataloader';
import { Language } from '../decorators/language.decorator';
import { BadRequestException, Inject } from '@nestjs/common';
import { BackstageArticleDto } from '../dto/backstage-article.dto';
import { ArticleMultiLanguageContentDto } from '../dto/article-multi-language-content.dto';
import { QuadratsContentScalar } from '../scalars/quadrats-element.scalar';
import { QuadratsElement } from '@quadrats/core';
import { ArticleStageVersionDto } from '../dto/article-stage-version.dto';
import { ArticleSignatureDto } from '../dto/article-signature.dto';

@Resolver(() => BackstageArticleDto)
export class BackstageArticleResolver {
  constructor(
    private readonly memberDataloader: MemberDataLoader,
    private readonly articleDataloader: ArticleDataLoader,
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multiLanguage: boolean,
    private readonly articleVersionDataLoader: ArticleVersionDataLoader,
    private readonly moduleArticleDataLoader: ModuleArticleDataLoader,
    private readonly versionSignaturesLoader: ArticleSignatureDataLoader,
  ) {}

  @ResolveField(() => ID)
  @Authenticated()
  id(@Root() article: ArticleBaseDto): string {
    return `${article.id}:${article.version}`;
  }

  @ResolveField(() => String)
  @Authenticated()
  articleId(@Root() article: ArticleBaseDto): string {
    return article.id;
  }

  @ResolveField(() => UserDto, { nullable: true })
  @Authenticated()
  submittedBy(@Root() article: ArticleBaseDto): Promise<UserDto | null> | null {
    return article.submittedBy ? this.memberDataloader.loader.load(article.submittedBy) : null;
  }

  @ResolveField(() => UserDto, { nullable: true })
  @Authenticated()
  lastEditor(@Root() article: ArticleBaseDto): Promise<UserDto | null> | null {
    return article.updatedBy ? this.memberDataloader.loader.load(article.updatedBy) : null;
  }

  @ResolveField(() => UserDto, { nullable: true })
  @Authenticated()
  releasedBy(@Root() article: ArticleBaseDto): Promise<UserDto | null> | null {
    return article.releasedBy ? this.memberDataloader.loader.load(article.releasedBy) : null;
  }

  @ResolveField(() => [CategoryDto])
  @Authenticated()
  categories(@Root() article: ArticleBaseDto, @Language() language: string = DEFAULT_LANGUAGE): Promise<CategoryDto[]> {
    return this.articleDataloader.categoriesLoaderNoCache.load({
      articleId: article.id,
      language: this.multiLanguage ? language : DEFAULT_LANGUAGE,
    });
  }

  @ResolveField(() => String)
  @Authenticated()
  title(@Root() article: ArticleBaseDto): string {
    if ('title' in article && !this.multiLanguage) {
      return article.title;
    }

    throw new BadRequestException('Title field is not available in multi-language mode.');
  }

  @ResolveField(() => String, { nullable: true })
  @Authenticated()
  description(@Root() article: ArticleBaseDto): string | null {
    if ('description' in article && !this.multiLanguage) {
      return article.description ?? null;
    }

    throw new BadRequestException('Description field is not available in multi-language mode.');
  }

  @ResolveField(() => QuadratsContentScalar)
  @Authenticated()
  content(@Root() article: ArticleBaseDto): QuadratsElement[] {
    if ('content' in article && !this.multiLanguage) {
      return article.content;
    }

    throw new BadRequestException('Content field is not available in multi-language mode.');
  }

  @ResolveField(() => [ArticleMultiLanguageContentDto])
  @Authenticated()
  multiLanguageContents(@Root() article: ArticleBaseDto): ArticleMultiLanguageContentDto[] {
    if ('multiLanguageContents' in article) {
      return article.multiLanguageContents;
    }

    return [
      {
        language: DEFAULT_LANGUAGE,
        title: article.title,
        description: article.description,
        content: article.content,
      },
    ];
  }

  @ResolveField(() => [BackstageArticleDto])
  @Authenticated()
  versions(@Root() article: ArticleBaseDto): Promise<BackstageArticleDto[]> {
    return this.articleVersionDataLoader.versionsLoader.load(article.id);
  }

  @ResolveField(() => ArticleStage)
  @Authenticated()
  stage(@Root() article: ArticleBaseDto): Promise<ArticleStage> {
    return this.moduleArticleDataLoader.stageLoader.load({
      id: article.id,
      version: article.version,
    });
  }

  @ResolveField(() => [ArticleSignatureDto])
  @Authenticated()
  signatures(@Root() article: ArticleBaseDto): Promise<ArticleSignatureDto[]> {
    return this.versionSignaturesLoader.versionSignaturesLoader.load({
      id: article.id,
      version: article.version,
    });
  }

  @ResolveField(() => ArticleStageVersionDto)
  @Authenticated()
  async stageVersions(@Root() article: ArticleBaseDto): Promise<ArticleStageVersionDto> {
    const versions = await this.articleVersionDataLoader.stageVersionsLoader.load(article.id);

    return {
      id: article.id,
      draft: versions[ArticleStage.DRAFT] ?? null,
      reviewing: versions[ArticleStage.REVIEWING] ?? null,
      verified: versions[ArticleStage.VERIFIED] ?? null,
      scheduled: versions[ArticleStage.SCHEDULED] ?? null,
      released: versions[ArticleStage.RELEASED] ?? null,
    };
  }
}
