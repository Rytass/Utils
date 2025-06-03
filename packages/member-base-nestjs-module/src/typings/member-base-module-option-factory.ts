import type { BaseMemberEntity } from '../models/base-member.entity';
import type { MemberBaseModuleOptionsDto } from './member-base-module-options.dto';

export interface MemberBaseModuleOptionFactory<
  T extends BaseMemberEntity = BaseMemberEntity,
> {
  createMemberOptions():
    | Promise<MemberBaseModuleOptionsDto<T>>
    | MemberBaseModuleOptionsDto<T>;
}
