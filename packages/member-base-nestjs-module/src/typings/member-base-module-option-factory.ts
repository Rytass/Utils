import type { BaseMemberEntity } from '../models/base-member.entity';
import type { MemberBaseModuleOptionsDTO } from './member-base-module-options.dto';

export interface MemberBaseModuleOptionFactoryInterface<
  MemberEntity extends BaseMemberEntity = BaseMemberEntity,
  TokenPayload extends {
    id: string;
    account?: string;
    domain?: string;
  } = Pick<MemberEntity, 'id' | 'account'> & {
    domain?: string;
  },
> {
  createMemberOptions():
    | Promise<MemberBaseModuleOptionsDTO<MemberEntity, TokenPayload>>
    | MemberBaseModuleOptionsDTO<MemberEntity, TokenPayload>;
}

// Non-breaking alias with community-preferred naming
export type MemberBaseOptionsFactory<
  MemberEntity extends BaseMemberEntity = BaseMemberEntity,
  TokenPayload extends {
    id: string;
    account?: string;
    domain?: string;
  } = Pick<MemberEntity, 'id' | 'account'> & {
    domain?: string;
  },
> = MemberBaseModuleOptionFactoryInterface<MemberEntity, TokenPayload>;
