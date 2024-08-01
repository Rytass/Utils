import { randomBytes } from 'node:crypto';
import {
  ACCESS_TOKEN_EXPIRATION,
  ACCESS_TOKEN_SECRET,
  CASBIN_ENFORCER,
  ENABLE_GLOBAL_GUARD,
  LOGIN_FAILED_BAN_THRESHOLD,
  MEMBER_BASE_MODULE_OPTIONS,
  PROVIDE_MEMBER_ENTITY,
  REFRESH_TOKEN_EXPIRATION,
  REFRESH_TOKEN_SECRET,
  RESET_PASSWORD_TOKEN_EXPIRATION,
  RESET_PASSWORD_TOKEN_SECRET,
} from '../typings/member-base-providers';
import { newEnforcer, newModelFromString } from 'casbin';
import { MemberBaseModuleOptionsDto } from '../typings/member-base-module-options.dto';
import { Provider } from '@nestjs/common';
import { CASBIN_MODEL } from './casbin-models/rbac-with-domains';
import type TypeORMAdapterType from 'typeorm-adapter';

const TypeORMAdapter: typeof TypeORMAdapterType =
  require('typeorm-adapter').default;

export const OptionProviders = [
  {
    provide: LOGIN_FAILED_BAN_THRESHOLD,
    useFactory: (options?: MemberBaseModuleOptionsDto) =>
      options?.loginFailedBanThreshold ?? 5,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: RESET_PASSWORD_TOKEN_EXPIRATION,
    useFactory: (options?: MemberBaseModuleOptionsDto) =>
      options?.resetPasswordTokenExpiration ?? 60 * 60 * 1,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: RESET_PASSWORD_TOKEN_SECRET,
    useFactory: (options?: MemberBaseModuleOptionsDto) =>
      options?.resetPasswordTokenSecret ?? randomBytes(16).toString('hex'),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_MEMBER_ENTITY,
    useFactory: (options?: MemberBaseModuleOptionsDto) =>
      options?.memberEntity ?? null,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ACCESS_TOKEN_SECRET,
    useFactory: (options?: MemberBaseModuleOptionsDto) =>
      options?.accessTokenSecret ?? randomBytes(16).toString('hex'),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ACCESS_TOKEN_EXPIRATION,
    useFactory: (options?: MemberBaseModuleOptionsDto) =>
      options?.accessTokenExpiration ?? 60 * 15,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: REFRESH_TOKEN_SECRET,
    useFactory: (options?: MemberBaseModuleOptionsDto) =>
      options?.refreshTokenSecret ?? randomBytes(16).toString('hex'),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: REFRESH_TOKEN_EXPIRATION,
    useFactory: (options?: MemberBaseModuleOptionsDto) =>
      options?.refreshTokenExpiration ?? 60 * 60 * 24 * 90,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ENABLE_GLOBAL_GUARD,
    useFactory: (options?: MemberBaseModuleOptionsDto) =>
      options?.enableGlobalGuard ?? true,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: CASBIN_ENFORCER,
    useFactory: async (options?: MemberBaseModuleOptionsDto) => {
      if (!options?.casbinAdapterOptions) return null;

      const adapter = await TypeORMAdapter.newAdapter(
        options.casbinAdapterOptions,
      );

      const enforcer = await newEnforcer();

      const model = newModelFromString(
        options.casbinModelString || CASBIN_MODEL,
      );

      await enforcer.initWithModelAndAdapter(model, adapter);
      await enforcer.loadPolicy();

      return enforcer;
    },
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
] as Provider[];
