import { Options, Provider } from '@nestjs/common';
import {
  CIRCULAR_CATEGORY_MODE,
  CMS_BASE_MODULE_OPTIONS,
  DRAFT_MODE,
  ENABLE_SIGNATURE_MODE,
  FULL_TEXT_SEARCH_MODE,
  MULTIPLE_CATEGORY_PARENT_MODE,
  MULTIPLE_LANGUAGE_MODE,
  PROVIDE_ARTICLE_ENTITY,
  PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY,
  PROVIDE_ARTICLE_VERSION_ENTITY,
  PROVIDE_CATEGORY_ENTITY,
  PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY,
  PROVIDE_SIGNATURE_LEVEL_ENTITY,
  SIGNATURE_LEVELS,
} from '../typings/cms-base-providers';
import { CMSBaseModuleOptionsDto } from '../typings/cms-base-root-module-options.dto';

export const OptionProviders = [
  {
    provide: MULTIPLE_LANGUAGE_MODE,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.multipleLanguageMode ?? false,
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: MULTIPLE_CATEGORY_PARENT_MODE,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.allowMultipleParentCategories ?? false,
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: CIRCULAR_CATEGORY_MODE,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.allowCircularCategories ?? false,
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: ENABLE_SIGNATURE_MODE,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.signatureMode ?? null,
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: SIGNATURE_LEVELS,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.signatureLevels ?? [],
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_ARTICLE_ENTITY,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.articleEntity ?? null,
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_ARTICLE_VERSION_ENTITY,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.articleVersionEntity ?? null,
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.articleVersionContentEntity ?? null,
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_CATEGORY_ENTITY,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.categoryEntity ?? null,
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.categoryMultiLanguageNameEntity ?? null,
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_SIGNATURE_LEVEL_ENTITY,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.signatureLevelEntity ?? null,
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: FULL_TEXT_SEARCH_MODE,
    useFactory: async (options?: CMSBaseModuleOptionsDto) => {
      if (!options?.fullTextSearchMode) return false;

      try {
        await import('@node-rs/jieba');

        return true;
      } catch (ex) {
        throw new Error(
          'Full Text Search Mode requires @node-rs/jieba module, please install it first.',
        );
      }
    },
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
  {
    provide: DRAFT_MODE,
    useFactory: (options?: CMSBaseModuleOptionsDto) =>
      options?.enableDraftMode ?? false,
    inject: [CMS_BASE_MODULE_OPTIONS],
  },
] as Provider[];
