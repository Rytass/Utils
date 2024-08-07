import { CMSBaseModuleOptionsDto } from './cms-base-root-module-options.dto';

export interface CMSBaseModuleOptionFactory {
  createCMSOptions():
    | Promise<CMSBaseModuleOptionsDto>
    | CMSBaseModuleOptionsDto;
}
