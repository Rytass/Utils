import { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import { CMSGraphqlBaseModuleOptionFactory } from './cms-graphql-base-root-module-option-factory';
import { CMSGraphqlBaseModuleOptionsDto } from './cms-graphql-base-root-module-options.dto';

export interface CMSGraphqlBaseModuleAsyncOptionsDto extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: (InjectionToken | OptionalFactoryDependency)[]
  ) => Promise<CMSGraphqlBaseModuleOptionsDto> | CMSGraphqlBaseModuleOptionsDto;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<CMSGraphqlBaseModuleOptionFactory>;
  useExisting?: Type<CMSGraphqlBaseModuleOptionFactory>;
}
