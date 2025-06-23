import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import {
  CategoryBaseService,
  DEFAULT_LANGUAGE,
} from '@rytass/cms-base-nestjs-module';
import { CategoriesArgs } from '../dto/categories.args';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { CategoryDto } from '../dto/category.dto';
import { Language } from '../decorators/language.decorator';
import { CategoryBackstageDto } from '../dto/category-backstage.dto';

@Resolver()
export class CategoryQueries {
  constructor(private readonly categoryService: CategoryBaseService) {}

  @Query(() => CategoryDto)
  @IsPublic()
  category(
    @Args('id', { type: () => ID }) id: string,
    @Language() language: string = DEFAULT_LANGUAGE,
  ): Promise<CategoryDto> {
    return this.categoryService.findById(id, language);
  }

  @Query(() => [CategoryDto])
  @IsPublic()
  categories(
    @Args() args: CategoriesArgs,
    @Language() language: string = DEFAULT_LANGUAGE,
  ): Promise<CategoryDto[]> {
    return this.categoryService.findAll({
      ...args,
      language,
    });
  }

  @Query(() => CategoryBackstageDto)
  @IsPublic()
  backstageCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CategoryBackstageDto> {
    return this.categoryService.findById(id);
  }

  @Query(() => [CategoryBackstageDto])
  @IsPublic()
  backstageCategories(
    @Args() args: CategoriesArgs,
  ): Promise<CategoryBackstageDto[]> {
    return this.categoryService.findAll(args);
  }
}
