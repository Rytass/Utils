import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import type { MemberBaseModuleOptionsDTO } from './member-base-module-options.dto';
import type { MemberBaseModuleOptionFactoryInterface } from './member-base-module-option-factory';
import type { BaseMemberEntity } from '../models/base-member.entity';

export interface MemberBaseModuleAsyncOptionsDTO<
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
    | Promise<MemberBaseModuleOptionsDTO<MemberEntity, TokenPayload>>
    | MemberBaseModuleOptionsDTO<MemberEntity, TokenPayload>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<MemberBaseModuleOptionFactoryInterface<MemberEntity, TokenPayload>>;
  useExisting?: Type<MemberBaseModuleOptionFactoryInterface<MemberEntity, TokenPayload>>;
}

// Non-breaking alias with community-preferred naming
export type MemberBaseModuleAsyncOptions<
  MemberEntity extends BaseMemberEntity = BaseMemberEntity,
  TokenPayload extends {
    id: string;
    account?: string;
    domain?: string;
  } = Pick<MemberEntity, 'id' | 'account'> & {
    domain?: string;
  },
> = MemberBaseModuleAsyncOptionsDTO<MemberEntity, TokenPayload>;
