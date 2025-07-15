import { ModuleMetadata, Type } from '@nestjs/common';
import { CMSGraphqlBaseModuleOptionFactory } from './cms-graphql-base-root-module-option-factory';
import { CMSGraphqlBaseModuleOptionsDto } from './cms-graphql-base-root-module-options.dto';

export interface CMSGraphqlBaseModuleAsyncOptionsDto
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: any[]
  ) => Promise<CMSGraphqlBaseModuleOptionsDto> | CMSGraphqlBaseModuleOptionsDto;
  inject?: any[];
  useClass?: Type<CMSGraphqlBaseModuleOptionFactory>;
  useExisting?: Type<CMSGraphqlBaseModuleOptionFactory>;
}
