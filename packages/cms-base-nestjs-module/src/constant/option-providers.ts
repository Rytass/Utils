import { Options, Provider } from '@nestjs/common';
import {
  CIRCULAR_CATEGORY_MODE,
  CMS_BASE_MODULE_OPTIONS,
  MULTIPLE_CATEGORY_PARENT_MODE,
  MULTIPLE_LANGUAGE_MODE,
  PROVIDE_ARTICLE_ENTITY,
  PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY,
  PROVIDE_ARTICLE_VERSION_ENTITY,
  PROVIDE_CATEGORY_ENTITY,
  PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY,
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
] as Provider[];
