import { ModuleMetadata, Type } from '@nestjs/common';
import { CMSGraphqlBaseModuleOptionFactory } from './cms-graphql-base-root-module-option-factory';
import { CMSGraphqlBaseModuleOptionsDto } from './cms-graphql-base-root-module-options.dto';
import { FactoryFunctionArgs, DependencyInjectionToken } from './module-factory.type';

export interface CMSGraphqlBaseModuleAsyncOptionsDto extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: FactoryFunctionArgs
  ) => Promise<CMSGraphqlBaseModuleOptionsDto> | CMSGraphqlBaseModuleOptionsDto;
  inject?: DependencyInjectionToken[];
  useClass?: Type<CMSGraphqlBaseModuleOptionFactory>;
  useExisting?: Type<CMSGraphqlBaseModuleOptionFactory>;
}
