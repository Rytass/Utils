import { ResolveField, Resolver, Root } from '@nestjs/graphql';
import { ArticleDto } from '../dto/article.dto';
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

@Resolver(() => ArticleDto)
export class ArticleResolver {
  constructor(
    private readonly memberDataloader: MemberDataLoader,
    private readonly articleDataloader: ArticleDataLoader,
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multiLanguage: boolean,
  ) {}

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
