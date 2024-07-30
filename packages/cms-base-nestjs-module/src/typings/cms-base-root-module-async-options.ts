import { ModuleMetadata, Type } from '@nestjs/common';
import { CMSBaseRootModuleOptionsDto } from './cms-base-root-module-options.dto';
import { CMSBaseRootModuleOptionFactory } from './cms-base-root-module-option-factory';

export interface CMSBaseRootModuleAsyncOptionsDto
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: any[]
  ) => Promise<CMSBaseRootModuleOptionsDto> | CMSBaseRootModuleOptionsDto;
  inject?: any[];
  useClass?: Type<CMSBaseRootModuleOptionFactory>;
  useExisting?: Type<CMSBaseRootModuleOptionFactory>;
}
