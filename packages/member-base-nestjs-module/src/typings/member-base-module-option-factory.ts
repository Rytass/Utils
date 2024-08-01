import { MemberBaseModuleOptionsDto } from './member-base-module-options.dto';

export interface MemberBaseModuleOptionFactory {
  createMemberOptions():
    | Promise<MemberBaseModuleOptionsDto>
    | MemberBaseModuleOptionsDto;
}
