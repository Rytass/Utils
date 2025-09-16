import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import type { MemberBaseModuleOptionsDto } from './member-base-module-options.dto';
import type { MemberBaseModuleOptionFactory } from './member-base-module-option-factory';
import type { BaseMemberEntity } from '../models/base-member.entity';

export interface MemberBaseModuleAsyncOptionsDto<
  MemberEntity extends BaseMemberEntity = BaseMemberEntity,
  TokenPayload extends Record<string, unknown> = Pick<MemberEntity, 'id' | 'account'>,
> extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: (InjectionToken | OptionalFactoryDependency)[]
  ) =>
    | Promise<MemberBaseModuleOptionsDto<MemberEntity, TokenPayload>>
    | MemberBaseModuleOptionsDto<MemberEntity, TokenPayload>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<MemberBaseModuleOptionFactory<MemberEntity, TokenPayload>>;
  useExisting?: Type<MemberBaseModuleOptionFactory<MemberEntity, TokenPayload>>;
}
