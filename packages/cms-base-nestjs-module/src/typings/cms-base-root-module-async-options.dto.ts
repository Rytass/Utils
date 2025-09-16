import { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import { CMSBaseModuleOptionsDto } from './cms-base-root-module-options.dto';
import { CMSBaseModuleOptionFactory } from './cms-base-root-module-option-factory';

export interface CMSBaseModuleAsyncOptionsDto extends Pick<ModuleMetadata, 'imports'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory?: (...args: any[]) => Promise<CMSBaseModuleOptionsDto> | CMSBaseModuleOptionsDto;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<CMSBaseModuleOptionFactory>;
  useExisting?: Type<CMSBaseModuleOptionFactory>;
}
