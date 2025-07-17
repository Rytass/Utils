import { Provider } from '@nestjs/common';
import {
  CMS_BASE_GRAPHQL_MODULE_OPTIONS,
  MAP_ARTICLE_CUSTOM_FIELDS_TO_ENTITY_COLUMNS,
  MAP_CATEGORY_CUSTOM_FIELDS_TO_ENTITY_COLUMNS,
} from '../typings/cms-graphql-base-providers';
import { CMSGraphqlBaseModuleOptionsDto } from '../typings/cms-graphql-base-root-module-options.dto';

export const OptionProviders = [
  {
    provide: MAP_ARTICLE_CUSTOM_FIELDS_TO_ENTITY_COLUMNS,
    useFactory: async (options?: CMSGraphqlBaseModuleOptionsDto) =>
      options?.mapArticleCustomFieldsToEntityColumns
        ? options.mapArticleCustomFieldsToEntityColumns
        : () => ({}),
    inject: [CMS_BASE_GRAPHQL_MODULE_OPTIONS],
  },
  {
    provide: MAP_CATEGORY_CUSTOM_FIELDS_TO_ENTITY_COLUMNS,
    useFactory: async (options?: CMSGraphqlBaseModuleOptionsDto) =>
      options?.mapCategoryCustomFieldsToEntityColumns
        ? options.mapCategoryCustomFieldsToEntityColumns
        : () => ({}),
    inject: [CMS_BASE_GRAPHQL_MODULE_OPTIONS],
  },
] as Provider[];
