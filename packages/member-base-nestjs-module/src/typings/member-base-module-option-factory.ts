import type { BaseMemberEntity } from '../models/base-member.entity';
import type { MemberBaseModuleOptionsDto } from './member-base-module-options.dto';

export interface MemberBaseModuleOptionFactory<
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
    | Promise<MemberBaseModuleOptionsDto<MemberEntity, TokenPayload>>
    | MemberBaseModuleOptionsDto<MemberEntity, TokenPayload>;
}
