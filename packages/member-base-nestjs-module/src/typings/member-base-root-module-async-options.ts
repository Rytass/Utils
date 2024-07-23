import { ModuleMetadata } from '@nestjs/common';
import { MemberBaseRootModuleOptionsDto } from './member-base-root-module-options.dto';

export interface MemberBaseRootModuleAsyncOptionsDto
  extends Pick<ModuleMetadata, 'imports'>,
    MemberBaseRootModuleOptionsDto {}
