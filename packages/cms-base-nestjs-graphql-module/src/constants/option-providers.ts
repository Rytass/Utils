import { Provider } from '@nestjs/common';
import {
  CMS_BASE_GRAPHQL_MODULE_OPTIONS,
  MAP_ARTICLE_CUSTOM_FIELDS_TO_ENTITY_COLUMNS,
  MAP_CATEGORY_CUSTOM_FIELDS_TO_ENTITY_COLUMNS,
} from '../typings/cms-graphql-base-providers';
import { CMSGraphqlBaseModuleOptionsDto } from '../typings/cms-graphql-base-root-module-options.dto';
import { CustomFieldInput } from '../dto/custom-field.input';

export const OptionProviders = [
  {
    provide: MAP_ARTICLE_CUSTOM_FIELDS_TO_ENTITY_COLUMNS,
    useFactory: async (
      options?: CMSGraphqlBaseModuleOptionsDto,
    ): Promise<
      (customFields: CustomFieldInput[]) => Promise<Record<string, string | object>> | Record<string, string | object>
    > =>
      options?.mapArticleCustomFieldsToEntityColumns
        ? options.mapArticleCustomFieldsToEntityColumns
        : (): Record<string, string | object> => ({}),
    inject: [CMS_BASE_GRAPHQL_MODULE_OPTIONS],
  },
  {
    provide: MAP_CATEGORY_CUSTOM_FIELDS_TO_ENTITY_COLUMNS,
    useFactory: async (
      options?: CMSGraphqlBaseModuleOptionsDto,
    ): Promise<
      (customFields: CustomFieldInput[]) => Promise<Record<string, string | object>> | Record<string, string | object>
    > =>
      options?.mapCategoryCustomFieldsToEntityColumns
        ? options.mapCategoryCustomFieldsToEntityColumns
        : (): Record<string, string | object> => ({}),
    inject: [CMS_BASE_GRAPHQL_MODULE_OPTIONS],
  },
] as Provider[];
