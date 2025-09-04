import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { CategoryBaseService, MULTIPLE_LANGUAGE_MODE } from '@rytass/cms-base-nestjs-module';
import { CreateCategoryArgs } from '../dto/create-category.args';
import { AllowActions } from '@rytass/member-base-nestjs-module';
import { BackstageCategoryDto } from '../dto/backstage-category.dto';
import { UpdateCategoryArgs } from '../dto/update-category.args';
import { Inject } from '@nestjs/common';
import { BaseAction } from '../constants/enum/base-action.enum';
import { BaseResource } from '../constants/enum/base-resource.enum';
import { MAP_CATEGORY_CUSTOM_FIELDS_TO_ENTITY_COLUMNS } from '../typings/cms-graphql-base-providers';
import { CustomFieldInput } from '../dto/custom-field.input';

@Resolver()
export class CategoryMutations {
  constructor(
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multiLanguage: boolean,
    @Inject(MAP_CATEGORY_CUSTOM_FIELDS_TO_ENTITY_COLUMNS)
    private readonly mapCategoryCustomFieldsToEntityColumns: (
      customFields: CustomFieldInput[],
    ) => Promise<Record<string, string>>,
    private readonly categoryService: CategoryBaseService,
  ) {}

  private async resolveCreateCategoryArgs(args: CreateCategoryArgs) {
    const extraArgsInput: Record<string, string | object> = {};

    if (args.customFields?.length) {
      Object.assign(extraArgsInput, await this.mapCategoryCustomFieldsToEntityColumns(args.customFields));
    }

    const basePayload = {
      parentIds: args.parentIds,
      ...extraArgsInput,
    };

    if (!this.multiLanguage) {
      const [content] = args.multiLanguageNames;

      return {
        ...basePayload,
        name: content.name,
      };
    }

    const multiLanguageNames = Object.fromEntries(args.multiLanguageNames.map(name => [name.language, name.name]));

    return {
      ...basePayload,
      multiLanguageNames,
    };
  }

  @Mutation(() => BackstageCategoryDto)
  @AllowActions([[BaseResource.CATEGORY, BaseAction.CREATE]])
  async createCategory(@Args() args: CreateCategoryArgs): Promise<BackstageCategoryDto> {
    return this.categoryService.create({
      ...(await this.resolveCreateCategoryArgs(args)),
    });
  }

  @Mutation(() => BackstageCategoryDto)
  @AllowActions([[BaseResource.CATEGORY, BaseAction.UPDATE]])
  async updateCategory(@Args() args: UpdateCategoryArgs): Promise<BackstageCategoryDto> {
    return this.categoryService.update(args.id, {
      ...(await this.resolveCreateCategoryArgs(args)),
    });
  }

  @Mutation(() => Boolean)
  @AllowActions([[BaseResource.CATEGORY, BaseAction.DELETE]])
  async deleteCategory(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    await this.categoryService.archive(id);

    return true;
  }
}
