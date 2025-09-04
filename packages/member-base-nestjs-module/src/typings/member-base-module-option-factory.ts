import type { BaseMemberEntity } from '../models/base-member.entity';
import type { MemberBaseModuleOptionsDto } from './member-base-module-options.dto';

export interface MemberBaseModuleOptionFactory<
  MemberEntity extends BaseMemberEntity = BaseMemberEntity,
  TokenPayload extends Record<string, any> = Pick<MemberEntity, 'id' | 'account'>,
> {
  createMemberOptions():
    | Promise<MemberBaseModuleOptionsDto<MemberEntity, TokenPayload>>
    | MemberBaseModuleOptionsDto<MemberEntity, TokenPayload>;
}
