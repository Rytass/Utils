import { ModuleMetadata } from '@nestjs/common';

export interface MemberBaseRootModuleAsyncOptionsDto extends Pick<ModuleMetadata, 'imports'> {
  loginFailedBanThreshold?: number; // default: 5
}
