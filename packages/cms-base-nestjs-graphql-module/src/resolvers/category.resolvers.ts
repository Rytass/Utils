import { ResolveField, Resolver, Root } from '@nestjs/graphql';
import {
  BackstageCategory,
  BaseCategory,
  Category,
  CategoryMultiLanguageName,
} from '../dto/category.dto';
import { CategoryDataLoader } from '../data-loaders/category.dataloader';
import { IsPublic } from '@rytass/member-base-nestjs-module';

@Resolver(() => Category)
export class CategoryResolvers {
  constructor(private readonly categoryDataLoader: CategoryDataLoader) {}

  @ResolveField(() => String)
  @IsPublic()
  async name(@Root() category: BaseCategory): Promise<string> {
    const multiLanguageNames =
      await this.categoryDataLoader.multiLanguageNameLoader.load(category.id);

    return multiLanguageNames[0]?.name ?? 'name not found';
  }
}

@Resolver(() => BackstageCategory)
export class BackstageCategoryResolvers {
  constructor(private readonly categoryDataLoader: CategoryDataLoader) {}

  @ResolveField(() => [CategoryMultiLanguageName])
  @IsPublic()
  multiLanguageNames(
    @Root() category: BaseCategory,
  ): Promise<CategoryMultiLanguageName[]> {
    return this.categoryDataLoader.multiLanguageNameLoader.load(category.id);
  }
}
