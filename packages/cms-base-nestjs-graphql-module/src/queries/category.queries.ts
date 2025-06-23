import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { CategoryBaseService } from '@rytass/cms-base-nestjs-module';
import { CategoriesArgs } from '../dto/categories.args';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { BaseCategoryDto } from '../dto/base-category.dto';

@Resolver()
export class CategoryQueries {
  constructor(private readonly categoryService: CategoryBaseService) {}

  @Query(() => BaseCategoryDto)
  @IsPublic()
  category(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<BaseCategoryDto> {
    return this.categoryService.findById(id);
  }

  @Query(() => [BaseCategoryDto])
  @IsPublic()
  categories(@Args() args: CategoriesArgs): Promise<BaseCategoryDto[]> {
    return this.categoryService.findAll(args);
  }
}
