import { randomBytes } from 'node:crypto';
import {
  ACCESS_TOKEN_EXPIRATION,
  ACCESS_TOKEN_SECRET,
  CASBIN_ENFORCER,
  ENABLE_GLOBAL_GUARD,
  LOGIN_FAILED_BAN_THRESHOLD,
  MEMBER_BASE_MODULE_OPTIONS,
  PASSWORD_POLICY_REGEXP,
  PASSWORD_SHOULD_INCLUDE_DIGIT,
  PASSWORD_SHOULD_INCLUDE_LOWERCASE,
  PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER,
  PASSWORD_SHOULD_INCLUDE_UPPERCASE,
  PASSWORD_MIN_LENGTH,
  PROVIDE_MEMBER_ENTITY,
  REFRESH_TOKEN_EXPIRATION,
  REFRESH_TOKEN_SECRET,
  RESET_PASSWORD_TOKEN_EXPIRATION,
  RESET_PASSWORD_TOKEN_SECRET,
  PASSWORD_HISTORY_LIMIT,
  PASSWORD_AGE_LIMIT_IN_DAYS,
  ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD,
  FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED,
  CASBIN_PERMISSION_DECORATOR,
  CASBIN_PERMISSION_CHECKER,
  CUSTOMIZED_JWT_PAYLOAD,
  OAUTH2_PROVIDERS,
  OAUTH2_CLIENT_DEST_URL,
  COOKIE_MODE,
  LOGIN_FAILED_AUTO_UNLOCK_SECONDS,
} from '../typings/member-base-providers';
import { Enforcer, newEnforcer, newModelFromString } from 'casbin';
import { MemberBaseModuleOptionsDto } from '../typings/member-base-module-options.dto';
import { Provider } from '@nestjs/common';
import { Subject, Action } from '../decorators/action.decorator';
import { CASBIN_MODEL } from './casbin-models/rbac-with-domains';
import type TypeORMAdapterType from 'typeorm-adapter';
import { AllowActions } from '../decorators/action.decorator';
import { BaseMemberEntity } from '../models/base-member.entity';
import { DEFAULT_CASBIN_DOMAIN } from './default-casbin-domain';
import type { ReflectableDecorator } from '@nestjs/core';
import type { OAuth2Provider } from '../typings/oauth2-provider.interface';

const getTypeORMAdapter = async (): Promise<typeof TypeORMAdapterType> => {
  const module = (await import('typeorm-adapter')) as unknown as {
    default: {
      default: typeof TypeORMAdapterType;
    };
  };

  return module.default.default;
};

export const OptionProviders = [
  {
    provide: LOGIN_FAILED_BAN_THRESHOLD,
    useFactory: (options?: MemberBaseModuleOptionsDto): number => options?.loginFailedBanThreshold ?? 5,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: RESET_PASSWORD_TOKEN_EXPIRATION,
    useFactory: (options?: MemberBaseModuleOptionsDto): number => options?.resetPasswordTokenExpiration ?? 60 * 60 * 1,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: RESET_PASSWORD_TOKEN_SECRET,
    useFactory: (options?: MemberBaseModuleOptionsDto): string =>
      options?.resetPasswordTokenSecret ?? randomBytes(16).toString('hex'),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_MEMBER_ENTITY,
    useFactory: (options?: MemberBaseModuleOptionsDto): (new () => BaseMemberEntity) | null =>
      options?.memberEntity ?? null,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ACCESS_TOKEN_SECRET,
    useFactory: (options?: MemberBaseModuleOptionsDto): string =>
      options?.accessTokenSecret ?? randomBytes(16).toString('hex'),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ACCESS_TOKEN_EXPIRATION,
    useFactory: (options?: MemberBaseModuleOptionsDto): number => options?.accessTokenExpiration ?? 60 * 15,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: REFRESH_TOKEN_SECRET,
    useFactory: (options?: MemberBaseModuleOptionsDto): string =>
      options?.refreshTokenSecret ?? randomBytes(16).toString('hex'),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: REFRESH_TOKEN_EXPIRATION,
    useFactory: (options?: MemberBaseModuleOptionsDto): number => options?.refreshTokenExpiration ?? 60 * 60 * 24 * 90,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ENABLE_GLOBAL_GUARD,
    useFactory: (options?: MemberBaseModuleOptionsDto): boolean => options?.enableGlobalGuard ?? true,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: CASBIN_ENFORCER,
    useFactory: async (options?: MemberBaseModuleOptionsDto): Promise<Enforcer | null> => {
      if (!options?.casbinAdapterOptions) return null;

      const TypeORMAdapter = await getTypeORMAdapter();
      const adapter = await TypeORMAdapter.newAdapter(options.casbinAdapterOptions);

      const enforcer = await newEnforcer();

      const model = newModelFromString(options.casbinModelString || CASBIN_MODEL);

      await enforcer.initWithModelAndAdapter(model, adapter);
      await enforcer.loadPolicy();

      return enforcer;
    },
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: CASBIN_PERMISSION_DECORATOR,
    useFactory: async (options?: MemberBaseModuleOptionsDto): Promise<ReflectableDecorator<[string, string][]>> =>
      options?.casbinPermissionDecorator ?? AllowActions,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: CASBIN_PERMISSION_CHECKER,
    useFactory: async (
      options?: MemberBaseModuleOptionsDto,
    ): Promise<
      (params: {
        enforcer: Enforcer;
        payload: { id: string; account?: string; domain?: string } & Record<string, unknown>;
        actions: [Subject, Action][];
      }) => Promise<boolean>
    > =>
      options?.casbinPermissionChecker
        ? (options.casbinPermissionChecker as (params: {
            enforcer: Enforcer;
            payload: { id: string; account?: string; domain?: string } & Record<string, unknown>;
            actions: [Subject, Action][];
          }) => Promise<boolean>)
        : ({
            enforcer,
            payload,
            actions,
          }: {
            enforcer: Enforcer;
            payload: { id: string; account?: string; domain?: string } & Record<string, unknown>;
            actions: [Subject, Action][];
          }): Promise<boolean> =>
            Promise.all(
              actions.map(([subject, action]) =>
                enforcer.enforce(payload.id, payload.domain ?? DEFAULT_CASBIN_DOMAIN, subject, action),
              ),
            ).then(results => results.some(result => result)),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_SHOULD_INCLUDE_UPPERCASE,
    useFactory: (options?: MemberBaseModuleOptionsDto): boolean => options?.passwordShouldIncludeUppercase ?? true,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_SHOULD_INCLUDE_LOWERCASE,
    useFactory: (options?: MemberBaseModuleOptionsDto): boolean => options?.passwordShouldIncludeLowercase ?? true,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_SHOULD_INCLUDE_DIGIT,
    useFactory: (options?: MemberBaseModuleOptionsDto): boolean => options?.passwordShouldIncludeDigit ?? true,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER,
    useFactory: (options?: MemberBaseModuleOptionsDto): boolean =>
      options?.passwordShouldIncludeSpecialCharacters ?? false,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_MIN_LENGTH,
    useFactory: (options?: MemberBaseModuleOptionsDto): number => options?.passwordMinLength ?? 8,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_POLICY_REGEXP,
    useFactory: (options?: MemberBaseModuleOptionsDto): RegExp | undefined =>
      options?.passwordPolicyRegExp ?? undefined,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_HISTORY_LIMIT,
    useFactory: (options?: MemberBaseModuleOptionsDto): number | undefined =>
      options?.passwordHistoryLimit ?? undefined,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_AGE_LIMIT_IN_DAYS,
    useFactory: (options?: MemberBaseModuleOptionsDto): number | undefined =>
      options?.passwordAgeLimitInDays ?? undefined,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD,
    useFactory: (options?: MemberBaseModuleOptionsDto): boolean =>
      options?.onlyResetRefreshTokenExpirationByPassword ?? false,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED,
    useFactory: (options?: MemberBaseModuleOptionsDto): boolean => options?.forceRejectLoginOnPasswordExpired ?? false,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: CUSTOMIZED_JWT_PAYLOAD,
    useFactory: (
      options?: MemberBaseModuleOptionsDto,
    ): ((member: BaseMemberEntity) => { id: string; account?: string; domain?: string } & Record<string, unknown>) =>
      options?.customizedJwtPayload ??
      ((member: BaseMemberEntity): { id: string; account?: string; domain?: string } & Record<string, unknown> => ({
        id: member.id,
        account: member.account,
      })),
  },
  {
    provide: OAUTH2_PROVIDERS,
    useFactory: (options?: MemberBaseModuleOptionsDto): OAuth2Provider[] => options?.oauth2Providers ?? [],
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: OAUTH2_CLIENT_DEST_URL,
    useFactory: (options?: MemberBaseModuleOptionsDto): string => options?.oauth2ClientDestUrl ?? '/login',
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: COOKIE_MODE,
    useFactory: (options?: MemberBaseModuleOptionsDto): boolean => options?.cookieMode ?? false,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: LOGIN_FAILED_AUTO_UNLOCK_SECONDS,
    useFactory: (options?: MemberBaseModuleOptionsDto): number | null => options?.loginFailedAutoUnlockSeconds ?? null,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
] as Provider[];
