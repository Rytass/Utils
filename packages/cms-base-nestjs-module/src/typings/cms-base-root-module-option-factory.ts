import { CMSBaseRootModuleOptionsDto } from './cms-base-root-module-options.dto';

export interface CMSBaseRootModuleOptionFactory {
  createCMSOptions():
    | Promise<CMSBaseRootModuleOptionsDto>
    | CMSBaseRootModuleOptionsDto;
}
