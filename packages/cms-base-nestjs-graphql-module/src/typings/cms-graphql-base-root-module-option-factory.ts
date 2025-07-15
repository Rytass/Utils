import { CMSGraphqlBaseModuleOptionsDto } from './cms-graphql-base-root-module-options.dto';

export interface CMSGraphqlBaseModuleOptionFactory {
  createCMSOptions():
    | Promise<CMSGraphqlBaseModuleOptionsDto>
    | CMSGraphqlBaseModuleOptionsDto;
}
