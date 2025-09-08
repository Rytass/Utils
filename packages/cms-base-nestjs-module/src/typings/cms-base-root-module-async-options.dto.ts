import { ModuleMetadata, Type } from '@nestjs/common';
import { CMSBaseModuleOptionsDto } from './cms-base-root-module-options.dto';
import { CMSBaseModuleOptionFactory } from './cms-base-root-module-option-factory';
import { FactoryFunctionArgs, DependencyInjectionToken } from './module-factory.type';

export interface CMSBaseModuleAsyncOptionsDto extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (...args: FactoryFunctionArgs) => Promise<CMSBaseModuleOptionsDto> | CMSBaseModuleOptionsDto;
  inject?: DependencyInjectionToken[];
  useClass?: Type<CMSBaseModuleOptionFactory>;
  useExisting?: Type<CMSBaseModuleOptionFactory>;
}
