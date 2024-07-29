import { randomBytes } from 'node:crypto';
import {
  LOGIN_FAILED_BAN_THRESHOLD,
  RESET_PASSWORD_TOKEN_EXPIRATION,
  RESET_PASSWORD_TOKEN_SECRET,
} from '../typings/member-base-providers';
import { MemberBaseRootModuleOptionsDto } from '../typings/member-base-root-module-options.dto';
import { Provider } from '@nestjs/common';

export const getProvidersFromOptions = (
  options?: MemberBaseRootModuleOptionsDto,
): Provider[] => [
  {
    provide: LOGIN_FAILED_BAN_THRESHOLD,
    useValue: options?.loginFailedBanThreshold ?? 5,
  },
  {
    provide: RESET_PASSWORD_TOKEN_EXPIRATION,
    useValue: options?.resetPasswordTokenExpiration ?? 60 * 60 * 1,
  },
  {
    provide: RESET_PASSWORD_TOKEN_SECRET,
    useValue:
      options?.resetPasswordTokenSecret ?? randomBytes(16).toString('hex'),
  },
];
