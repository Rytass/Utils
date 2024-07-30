import { Provider } from '@nestjs/common';
import {
  CMS_BASE_MODULE_OPTIONS,
  MULTIPLE_LANGUAGE_MODE,
} from '../typings/cms-base-providers';
import { CMSBaseRootModuleOptionsDto } from '../typings/cms-base-root-module-options.dto';

export const getProvidersFromOptions = (): Provider[] => [
  {
    provide: MULTIPLE_LANGUAGE_MODE,
    inject: [CMS_BASE_MODULE_OPTIONS],
    useFactory: (options?: CMSBaseRootModuleOptionsDto) =>
      options?.multipleLanguageMode ?? false,
  },
];
