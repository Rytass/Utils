import { MemberBaseRootModuleOptionsDto } from './member-base-root-module-options.dto';

export interface MemberBaseRootModuleOptionFactory {
  createMemberOptions():
    | Promise<MemberBaseRootModuleOptionsDto>
    | MemberBaseRootModuleOptionsDto;
}
