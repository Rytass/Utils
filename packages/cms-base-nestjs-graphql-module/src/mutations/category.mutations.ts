import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { CategoryBaseService } from '@rytass/cms-base-nestjs-module';
import { CreateCategoryArgs } from '../dto/create-category.args';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { BackstageCategoryDto } from '../dto/backstage-category.dto';
import { UpdateCategoryArgs } from '../dto/update-category.args';

@Resolver()
export class CategoryMutations {
  constructor(private readonly categoryService: CategoryBaseService) {}

  @Mutation(() => BackstageCategoryDto)
  @IsPublic()
  createCategory(
    @Args() args: CreateCategoryArgs,
  ): Promise<BackstageCategoryDto> {
    return this.categoryService.create({
      ...args,
      multiLanguageNames: Object.fromEntries(
        args.multiLanguageNames.map((name) => [name.language, name.name]),
      ),
    });
  }

  @Mutation(() => BackstageCategoryDto)
  @IsPublic()
  updateCategory(
    @Args() args: UpdateCategoryArgs,
  ): Promise<BackstageCategoryDto> {
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
