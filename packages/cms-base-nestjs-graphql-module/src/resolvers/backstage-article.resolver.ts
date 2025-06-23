import { ResolveField, Resolver, Root } from '@nestjs/graphql';
import { MemberDataLoader } from '../data-loaders/members.dataloader';
import { UserDto } from '../dto/user.dto';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import {
  DEFAULT_LANGUAGE,
  MULTIPLE_LANGUAGE_MODE,
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

@Resolver(() => BackstageArticleDto)
export class BackstageArticleResolver {
  constructor(
    private readonly memberDataloader: MemberDataLoader,
    private readonly articleDataloader: ArticleDataLoader,
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multiLanguage: boolean,
  ) {}

  @ResolveField(() => UserDto, { nullable: true })
  @IsPublic()
  submittedBy(@Root() article: ArticleBaseDto): Promise<UserDto | null> | null {
    return article.submittedBy
      ? this.memberDataloader.loader.load(article.submittedBy)
      : null;
  }

  @ResolveField(() => UserDto, { nullable: true })
  @IsPublic()
  lastEditor(@Root() article: ArticleBaseDto): Promise<UserDto | null> | null {
    return article.updatedBy
      ? this.memberDataloader.loader.load(article.updatedBy)
      : null;
  }

  @ResolveField(() => UserDto, { nullable: true })
  @IsPublic()
  releasedBy(@Root() article: ArticleBaseDto): Promise<UserDto | null> | null {
    return article.releasedBy
      ? this.memberDataloader.loader.load(article.releasedBy)
      : null;
  }

  @ResolveField(() => [CategoryDto])
  @IsPublic()
  categories(
    @Root() article: ArticleBaseDto,
    @Language() language: string = DEFAULT_LANGUAGE,
  ): Promise<CategoryDto[]> {
    return this.articleDataloader.categoriesLoader.load({
      articleId: article.id,
      language: this.multiLanguage ? language : DEFAULT_LANGUAGE,
    });
  }

  @ResolveField(() => String)
  @IsPublic()
  title(@Root() article: ArticleBaseDto): string {
    if ('title' in article && !this.multiLanguage) {
      return article.title;
    }

    throw new BadRequestException(
      'Title field is not available in multi-language mode.',
    );
  }

  @ResolveField(() => String, { nullable: true })
  @IsPublic()
  description(@Root() article: ArticleBaseDto): string | null {
    if ('description' in article && !this.multiLanguage) {
      return article.description ?? null;
    }

    throw new BadRequestException(
      'Description field is not available in multi-language mode.',
    );
  }

  @ResolveField(() => QuadratsContentScalar)
  @IsPublic()
  content(@Root() article: ArticleBaseDto): QuadratsElement[] {
    if ('content' in article && !this.multiLanguage) {
      return article.content;
    }

    throw new BadRequestException(
      'Content field is not available in multi-language mode.',
    );
  }

  @ResolveField(() => [ArticleMultiLanguageContentDto])
  @IsPublic()
  multiLanguageContents(
    @Root() article: ArticleBaseDto,
  ): ArticleMultiLanguageContentDto[] {
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
}
