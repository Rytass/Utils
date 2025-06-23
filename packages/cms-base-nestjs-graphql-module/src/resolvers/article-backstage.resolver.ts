import { ResolveField, Resolver, Root } from '@nestjs/graphql';
import { MemberDataLoader } from '../dataloaders/members.dataloader';
import { UserDto } from '../dto/user.dto';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import {
  DEFAULT_LANGUAGE,
  MULTIPLE_LANGUAGE_MODE,
  type ArticleBaseDto,
} from '@rytass/cms-base-nestjs-module';
import { CategoryDto } from '../dto/category.dto';
import { ArticleDataLoader } from '../dataloaders/article.dataloader';
import { Language } from '../decorators/language.decorator';
import { Inject } from '@nestjs/common';
import { ArticleBackstageDto } from '../dto/article-backstage.dto';

@Resolver(() => ArticleBackstageDto)
export class ArticleBackstageResolver {
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
}
