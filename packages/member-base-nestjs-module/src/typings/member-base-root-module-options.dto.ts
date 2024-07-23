import { ModuleMetadata } from '@nestjs/common';

export interface MemberBaseRootModuleOptionsDto {
  loginFailedBanThreshold?: number; // default: 5
}
