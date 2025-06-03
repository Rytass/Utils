import type { ModuleMetadata, Type } from '@nestjs/common';
import type { MemberBaseModuleOptionsDto } from './member-base-module-options.dto';
import type { MemberBaseModuleOptionFactory } from './member-base-module-option-factory';
import type { BaseMemberEntity } from '../models/base-member.entity';

export interface MemberBaseModuleAsyncOptionsDto<
  T extends BaseMemberEntity = BaseMemberEntity,
> extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: any[]
  ) => Promise<MemberBaseModuleOptionsDto<T>> | MemberBaseModuleOptionsDto<T>;
  inject?: any[];
  useClass?: Type<MemberBaseModuleOptionFactory<T>>;
  useExisting?: Type<MemberBaseModuleOptionFactory<T>>;
}
