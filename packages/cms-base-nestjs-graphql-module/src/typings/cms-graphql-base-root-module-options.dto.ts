import { CMSBaseModuleOptionsDto } from '@rytass/cms-base-nestjs-module';
import { CustomFieldInput } from '../dto/custom-field.input';

export interface CMSGraphqlBaseModuleOptionsDto
  extends CMSBaseModuleOptionsDto {
  mapArticleCustomFieldsToEntityColumns?: (
    customFields: CustomFieldInput[],
  ) =>
    | Promise<Record<string, string | object>>
    | Record<string, string | object>;
  mapCategoryCustomFieldsToEntityColumns?: (
    customFields: CustomFieldInput[],
  ) =>
    | Promise<Record<string, string | object>>
    | Record<string, string | object>;
}
