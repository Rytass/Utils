import { Provider } from '@nestjs/common';
import { MULTIPLE_LANGUAGE_MODE } from '../typings/cms-base-providers';
import { CMSBaseRootModuleOptionsDto } from '../typings/cms-base-root-module-options.dto';

export const getProvidersFromOptions = (
  options?: CMSBaseRootModuleOptionsDto,
): Provider[] => [
  {
    provide: MULTIPLE_LANGUAGE_MODE,
    useValue: options?.multipleLanguageMode ?? false,
  },
];
