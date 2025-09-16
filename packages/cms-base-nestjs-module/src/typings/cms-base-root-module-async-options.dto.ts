import { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import { CMSBaseModuleOptionsDto } from './cms-base-root-module-options.dto';
import { CMSBaseModuleOptionFactory } from './cms-base-root-module-option-factory';

export interface CMSBaseModuleAsyncOptionsDto extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: (InjectionToken | OptionalFactoryDependency)[]
  ) => Promise<CMSBaseModuleOptionsDto> | CMSBaseModuleOptionsDto;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<CMSBaseModuleOptionFactory>;
  useExisting?: Type<CMSBaseModuleOptionFactory>;
}
