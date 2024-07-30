import { ModuleMetadata, Type } from '@nestjs/common';
import { MemberBaseRootModuleOptionsDto } from './member-base-root-module-options.dto';
import { MemberBaseRootModuleOptionFactory } from './member-base-root-module-option-factory';

export interface MemberBaseRootModuleAsyncOptionsDto
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: any[]
  ) => Promise<MemberBaseRootModuleOptionsDto> | MemberBaseRootModuleOptionsDto;
  inject?: any[];
  useClass?: Type<MemberBaseRootModuleOptionFactory>;
  useExisting?: Type<MemberBaseRootModuleOptionFactory>;
}
