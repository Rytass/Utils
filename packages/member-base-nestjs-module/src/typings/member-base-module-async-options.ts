import { ModuleMetadata, Type } from '@nestjs/common';
import { MemberBaseModuleOptionsDto } from './member-base-module-options.dto';
import { MemberBaseModuleOptionFactory } from './member-base-module-option-factory';

export interface MemberBaseModuleAsyncOptionsDto
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: any[]
  ) => Promise<MemberBaseModuleOptionsDto> | MemberBaseModuleOptionsDto;
  inject?: any[];
  useClass?: Type<MemberBaseModuleOptionFactory>;
  useExisting?: Type<MemberBaseModuleOptionFactory>;
}
