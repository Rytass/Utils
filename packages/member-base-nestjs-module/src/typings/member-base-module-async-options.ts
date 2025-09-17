import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import type { MemberBaseModuleOptionsDto } from './member-base-module-options.dto';
import type { MemberBaseModuleOptionFactory } from './member-base-module-option-factory';
import type { BaseMemberEntity } from '../models/base-member.entity';

export interface MemberBaseModuleAsyncOptionsDto<
  MemberEntity extends BaseMemberEntity = BaseMemberEntity,
  TokenPayload extends {
    id: string;
    account?: string;
    domain?: string;
  } = Pick<MemberEntity, 'id' | 'account'> & {
    domain?: string;
  },
> extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) =>
    | Promise<MemberBaseModuleOptionsDto<MemberEntity, TokenPayload>>
    | MemberBaseModuleOptionsDto<MemberEntity, TokenPayload>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<MemberBaseModuleOptionFactory<MemberEntity, TokenPayload>>;
  useExisting?: Type<MemberBaseModuleOptionFactory<MemberEntity, TokenPayload>>;
}
