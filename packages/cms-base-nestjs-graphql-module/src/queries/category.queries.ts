import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { CategoryBaseService } from '@rytass/cms-base-nestjs-module';
import { BackstageCategory, Category } from '../dto/category.dto';
import { CategoriesArgs } from '../dto/categories.args';
import { IsPublic } from '@rytass/member-base-nestjs-module';

@Resolver()
export class CategoryQueries {
  constructor(private readonly categoryService: CategoryBaseService) {}

  @Query(() => Category)
  @IsPublic()
  category(@Args('id', { type: () => ID }) id: string): Promise<Category> {
    return this.categoryService.findById(id);
  }

  @Query(() => [Category])
  @IsPublic()
  categories(@Args() args: CategoriesArgs): Promise<Category[]> {
    return this.categoryService.findAll(args);
  }

  @Query(() => BackstageCategory)
  @IsPublic()
  backstageCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<BackstageCategory> {
    return this.categoryService.findById(id);
  }

  @Query(() => [BackstageCategory])
  @IsPublic()
  backstageCategories(
    @Args() args: CategoriesArgs,
  ): Promise<BackstageCategory[]> {
    return this.categoryService.findAll(args);
  }
}
