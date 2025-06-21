import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { CategoryBaseService } from '@rytass/cms-base-nestjs-module';
import {
  CreateCategoryArgs,
  UpdateCategoryArgs,
} from '../dto/create-category.args';
import { BackstageCategory } from '../dto/category.dto';
import { IsPublic } from '@rytass/member-base-nestjs-module';

@Resolver()
export class CategoryMutations {
  constructor(private readonly categoryService: CategoryBaseService) {}

  @Mutation(() => BackstageCategory)
  @IsPublic()
  async createCategory(@Args() args: CreateCategoryArgs) {
    return this.categoryService.create({
      ...args,
      multiLanguageNames: Object.fromEntries(
        args.multiLanguageNames.map((name) => [name.language, name.name]),
      ),
    });
  }

  @Mutation(() => BackstageCategory)
  @IsPublic()
  updateCategory(@Args() args: UpdateCategoryArgs) {
    return this.categoryService.update(args.id, {
      ...args,
      multiLanguageNames: Object.fromEntries(
        args.multiLanguageNames.map((name) => [name.language, name.name]),
      ),
    });
  }

  @Mutation(() => Boolean)
  @IsPublic()
  async deleteCategory(@Args('id', { type: () => ID }) id: string) {
    await this.categoryService.archive(id);

    return true;
  }
}
