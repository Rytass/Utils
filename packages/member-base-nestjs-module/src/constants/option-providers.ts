import { randomBytes } from 'node:crypto';
import {
  LOGIN_FAILED_BAN_THRESHOLD,
  MEMBER_BASE_MODULE_OPTIONS,
  RESET_PASSWORD_TOKEN_EXPIRATION,
  RESET_PASSWORD_TOKEN_SECRET,
} from '../typings/member-base-providers';
import { MemberBaseRootModuleOptionsDto } from '../typings/member-base-root-module-options.dto';
import { Provider } from '@nestjs/common';

export const OptionProviders = [
  {
    provide: LOGIN_FAILED_BAN_THRESHOLD,
    useFactory: (options?: MemberBaseRootModuleOptionsDto) =>
      options?.loginFailedBanThreshold ?? 5,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: RESET_PASSWORD_TOKEN_EXPIRATION,
    useFactory: (options?: MemberBaseRootModuleOptionsDto) =>
      options?.resetPasswordTokenExpiration ?? 60 * 60 * 1,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: RESET_PASSWORD_TOKEN_SECRET,
    useFactory: (options?: MemberBaseRootModuleOptionsDto) =>
      options?.resetPasswordTokenSecret ?? randomBytes(16).toString('hex'),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
] as Provider[];
