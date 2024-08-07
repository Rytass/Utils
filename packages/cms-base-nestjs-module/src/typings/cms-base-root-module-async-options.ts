import { ModuleMetadata, Type } from '@nestjs/common';
import { CMSBaseModuleOptionsDto } from './cms-base-root-module-options.dto';
import { CMSBaseModuleOptionFactory } from './cms-base-root-module-option-factory';

export interface CMSBaseModuleAsyncOptionsDto
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: any[]
  ) => Promise<CMSBaseModuleOptionsDto> | CMSBaseModuleOptionsDto;
  inject?: any[];
  useClass?: Type<CMSBaseModuleOptionFactory>;
  useExisting?: Type<CMSBaseModuleOptionFactory>;
}
