import { ResolveField, Resolver, Root } from '@nestjs/graphql';
import { Authenticated } from '@rytass/member-base-nestjs-module';
import { type CategoryBaseDto, DEFAULT_LANGUAGE, MULTIPLE_LANGUAGE_MODE } from '@rytass/cms-base-nestjs-module';

import { BadRequestException, Inject } from '@nestjs/common';
import { CategoryMultiLanguageNameDto } from '../dto/category-multi-language-name.dto';
import { BackstageCategoryDto } from '../dto/backstage-category.dto';

@Resolver(() => BackstageCategoryDto)
export class BackstageCategoryResolver {
  constructor(
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multiLanguage: boolean,
  ) {}

  @ResolveField(() => String)
  @Authenticated()
  name(@Root() category: CategoryBaseDto): string {
    if ('name' in category && !this.multiLanguage) {
      return category.name;
    }

    throw new BadRequestException('Name field is not available in multi-language mode.');
  }

  @ResolveField(() => [CategoryMultiLanguageNameDto])
  @Authenticated()
  multiLanguageNames(@Root() category: CategoryBaseDto): CategoryMultiLanguageNameDto[] {
    if ('multiLanguageNames' in category) {
      return category.multiLanguageNames;
    }

    return [
      {
        language: DEFAULT_LANGUAGE,
        name: category.name,
      },
    ];
  }
}
