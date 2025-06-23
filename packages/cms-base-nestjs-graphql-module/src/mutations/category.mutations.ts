import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { CategoryBaseService } from '@rytass/cms-base-nestjs-module';
import { CreateCategoryArgs } from '../dto/create-category.args';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { CategoryBackstageDto } from '../dto/category-backstage.dto';
import { UpdateCategoryArgs } from '../dto/update-category.args';

@Resolver()
export class CategoryMutations {
  constructor(private readonly categoryService: CategoryBaseService) {}

  @Mutation(() => CategoryBackstageDto)
  @IsPublic()
  createCategory(
    @Args() args: CreateCategoryArgs,
  ): Promise<CategoryBackstageDto> {
    return this.categoryService.create({
      ...args,
      multiLanguageNames: Object.fromEntries(
        args.multiLanguageNames.map((name) => [name.language, name.name]),
      ),
    });
  }

  @Mutation(() => CategoryBackstageDto)
  @IsPublic()
  updateCategory(
    @Args() args: UpdateCategoryArgs,
  ): Promise<CategoryBackstageDto> {
    return this.categoryService.update(args.id, {
      ...args,
      multiLanguageNames: Object.fromEntries(
        args.multiLanguageNames.map((name) => [name.language, name.name]),
      ),
    });
  }

  @Mutation(() => Boolean)
  @IsPublic()
  async deleteCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.categoryService.archive(id);

    return true;
  }
}
