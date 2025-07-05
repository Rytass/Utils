import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import {
  CategoryBaseService,
  MULTIPLE_LANGUAGE_MODE,
} from '@rytass/cms-base-nestjs-module';
import { CreateCategoryArgs } from '../dto/create-category.args';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { BackstageCategoryDto } from '../dto/backstage-category.dto';
import { UpdateCategoryArgs } from '../dto/update-category.args';
import { Inject } from '@nestjs/common';

@Resolver()
export class CategoryMutations {
  constructor(
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multiLanguage: boolean,
    private readonly categoryService: CategoryBaseService,
  ) {}

  private resolveCreateCategoryArgs(args: CreateCategoryArgs) {
    const basePayload = {
      parentIds: args.parentIds,
    };

    if (!this.multiLanguage) {
      const [content] = args.multiLanguageNames;

      return {
        ...basePayload,
        name: content.name,
      };
    }

    const multiLanguageNames = Object.fromEntries(
      args.multiLanguageNames.map((name) => [name.language, name.name]),
    );

    return {
      ...basePayload,
      multiLanguageNames,
    };
  }

  @Mutation(() => BackstageCategoryDto)
  @IsPublic()
  createCategory(
    @Args() args: CreateCategoryArgs,
  ): Promise<BackstageCategoryDto> {
    return this.categoryService.create({
      ...this.resolveCreateCategoryArgs(args),
    });
  }

  @Mutation(() => BackstageCategoryDto)
  @IsPublic()
  updateCategory(
    @Args() args: UpdateCategoryArgs,
  ): Promise<BackstageCategoryDto> {
    return this.categoryService.update(args.id, {
      ...this.resolveCreateCategoryArgs(args),
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
