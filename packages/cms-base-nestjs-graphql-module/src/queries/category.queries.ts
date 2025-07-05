import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import {
  CategoryBaseService,
  DEFAULT_LANGUAGE,
  MULTIPLE_LANGUAGE_MODE,
} from '@rytass/cms-base-nestjs-module';
import { CategoriesArgs } from '../dto/categories.args';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { CategoryDto } from '../dto/category.dto';
import { Language } from '../decorators/language.decorator';
import { BackstageCategoryDto } from '../dto/backstage-category.dto';
import { Inject } from '@nestjs/common';

@Resolver()
export class CategoryQueries {
  constructor(
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multiLanguage: boolean,
    private readonly categoryService: CategoryBaseService,
  ) {}

  @Query(() => CategoryDto)
  @IsPublic()
  async category(
    @Args('id', { type: () => ID }) id: string,
    @Language() language: string = DEFAULT_LANGUAGE,
  ): Promise<CategoryDto> {
    if (this.multiLanguage) {
      return this.categoryService.findById(id, language);
    }

    return this.categoryService.findById(id) as Promise<CategoryDto>;
  }

  @Query(() => [CategoryDto])
  @IsPublic()
  categories(
    @Args() args: CategoriesArgs,
    @Language() language: string = DEFAULT_LANGUAGE,
  ): Promise<CategoryDto[]> {
    return this.categoryService.findAll({
      ...args,
      language: this.multiLanguage ? language : null,
    }) as Promise<CategoryDto[]>;
  }

  @Query(() => BackstageCategoryDto)
  @IsPublic()
  backstageCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<BackstageCategoryDto> {
    return this.categoryService.findById(id);
  }

  @Query(() => [BackstageCategoryDto])
  @IsPublic()
  backstageCategories(
    @Args() args: CategoriesArgs,
  ): Promise<BackstageCategoryDto[]> {
    return this.categoryService.findAll(args);
  }
}
