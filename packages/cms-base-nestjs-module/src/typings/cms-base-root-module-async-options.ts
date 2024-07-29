import { ModuleMetadata } from '@nestjs/common';
import { CMSBaseRootModuleOptionsDto } from './cms-base-root-module-options.dto';

export interface CMSBaseRootModuleAsyncOptionsDto
  extends Pick<ModuleMetadata, 'imports'>,
    CMSBaseRootModuleOptionsDto {}
