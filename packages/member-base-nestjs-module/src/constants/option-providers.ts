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
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../typings/member-base.tokens';
import { Enforcer, newEnforcer, newModelFromString } from 'casbin';
import { MemberBaseModuleOptionsDTO } from '../typings/member-base-module-options.dto';
import { Provider } from '@nestjs/common';
import { Subject, Action } from '../decorators/action.decorator';
import { CASBIN_MODEL } from './casbin-models/rbac-with-domains';
import type TypeORMAdapterType from 'typeorm-adapter';
import { AllowActions } from '../decorators/action.decorator';
import { BaseMemberEntity } from '../models/base-member.entity';
import { DEFAULT_CASBIN_DOMAIN } from './default-casbin-domain';
import type { ReflectableDecorator } from '@nestjs/core';
import type { OAuth2Provider } from '../typings/oauth2-provider.interface';
import type { AuthTokenPayloadBase } from '../typings/auth-token-payload';

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
    useFactory: (options?: MemberBaseModuleOptionsDTO): number => options?.loginFailedBanThreshold ?? 5,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: RESET_PASSWORD_TOKEN_EXPIRATION,
    useFactory: (options?: MemberBaseModuleOptionsDTO): number => options?.resetPasswordTokenExpiration ?? 60 * 60 * 1,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: RESET_PASSWORD_TOKEN_SECRET,
    useFactory: (options?: MemberBaseModuleOptionsDTO): string =>
      options?.resetPasswordTokenSecret ?? randomBytes(16).toString('hex'),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_MEMBER_ENTITY,
    useFactory: (options?: MemberBaseModuleOptionsDTO): (new () => BaseMemberEntity) | null =>
      options?.memberEntity ?? null,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ACCESS_TOKEN_SECRET,
    useFactory: (options?: MemberBaseModuleOptionsDTO): string =>
      options?.accessTokenSecret ?? randomBytes(16).toString('hex'),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ACCESS_TOKEN_EXPIRATION,
    useFactory: (options?: MemberBaseModuleOptionsDTO): number => options?.accessTokenExpiration ?? 60 * 15,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: REFRESH_TOKEN_SECRET,
    useFactory: (options?: MemberBaseModuleOptionsDTO): string =>
      options?.refreshTokenSecret ?? randomBytes(16).toString('hex'),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: REFRESH_TOKEN_EXPIRATION,
    useFactory: (options?: MemberBaseModuleOptionsDTO): number => options?.refreshTokenExpiration ?? 60 * 60 * 24 * 90,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ENABLE_GLOBAL_GUARD,
    useFactory: (options?: MemberBaseModuleOptionsDTO): boolean => options?.enableGlobalGuard ?? true,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: CASBIN_ENFORCER,
    useFactory: async (options?: MemberBaseModuleOptionsDTO): Promise<Enforcer | null> => {
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
    useFactory: async (options?: MemberBaseModuleOptionsDTO): Promise<ReflectableDecorator<[Subject, Action][]>> =>
      options?.casbinPermissionDecorator ?? AllowActions,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: CASBIN_PERMISSION_CHECKER,
    useFactory: async (
      options?: MemberBaseModuleOptionsDTO,
    ): Promise<
      (params: { enforcer: Enforcer; payload: AuthTokenPayloadBase; actions: [Subject, Action][] }) => Promise<boolean>
    > =>
      options?.casbinPermissionChecker
        ? (options.casbinPermissionChecker as (params: {
            enforcer: Enforcer;
            payload: AuthTokenPayloadBase;
            actions: [Subject, Action][];
          }) => Promise<boolean>)
        : ({
            enforcer,
            payload,
            actions,
          }: {
            enforcer: Enforcer;
            payload: AuthTokenPayloadBase;
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
    useFactory: (options?: MemberBaseModuleOptionsDTO): boolean => options?.passwordShouldIncludeUppercase ?? true,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_SHOULD_INCLUDE_LOWERCASE,
    useFactory: (options?: MemberBaseModuleOptionsDTO): boolean => options?.passwordShouldIncludeLowercase ?? true,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_SHOULD_INCLUDE_DIGIT,
    useFactory: (options?: MemberBaseModuleOptionsDTO): boolean => options?.passwordShouldIncludeDigit ?? true,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER,
    useFactory: (options?: MemberBaseModuleOptionsDTO): boolean =>
      options?.passwordShouldIncludeSpecialCharacters ?? false,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_MIN_LENGTH,
    useFactory: (options?: MemberBaseModuleOptionsDTO): number => options?.passwordMinLength ?? 8,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_POLICY_REGEXP,
    useFactory: (options?: MemberBaseModuleOptionsDTO): RegExp | undefined =>
      options?.passwordPolicyRegExp ?? undefined,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_HISTORY_LIMIT,
    useFactory: (options?: MemberBaseModuleOptionsDTO): number | undefined =>
      options?.passwordHistoryLimit ?? undefined,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: PASSWORD_AGE_LIMIT_IN_DAYS,
    useFactory: (options?: MemberBaseModuleOptionsDTO): number | undefined =>
      options?.passwordAgeLimitInDays ?? undefined,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD,
    useFactory: (options?: MemberBaseModuleOptionsDTO): boolean =>
      options?.onlyResetRefreshTokenExpirationByPassword ?? false,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED,
    useFactory: (options?: MemberBaseModuleOptionsDTO): boolean => options?.forceRejectLoginOnPasswordExpired ?? false,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: CUSTOMIZED_JWT_PAYLOAD,
    useFactory: (options?: MemberBaseModuleOptionsDTO): ((member: BaseMemberEntity) => AuthTokenPayloadBase) =>
      options?.customizedJwtPayload ??
      ((member: BaseMemberEntity): AuthTokenPayloadBase => ({ id: member.id, account: member.account })),
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: OAUTH2_PROVIDERS,
    useFactory: (options?: MemberBaseModuleOptionsDTO): OAuth2Provider[] => options?.oauth2Providers ?? [],
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: OAUTH2_CLIENT_DEST_URL,
    useFactory: (options?: MemberBaseModuleOptionsDTO): string => options?.oauth2ClientDestUrl ?? '/login',
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: COOKIE_MODE,
    useFactory: (options?: MemberBaseModuleOptionsDTO): boolean => options?.cookieMode ?? false,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: ACCESS_TOKEN_COOKIE_NAME,
    useFactory: (_options?: MemberBaseModuleOptionsDTO): string => 'access_token',
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: REFRESH_TOKEN_COOKIE_NAME,
    useFactory: (_options?: MemberBaseModuleOptionsDTO): string => 'refresh_token',
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
  {
    provide: LOGIN_FAILED_AUTO_UNLOCK_SECONDS,
    useFactory: (options?: MemberBaseModuleOptionsDTO): number | null => options?.loginFailedAutoUnlockSeconds ?? null,
    inject: [MEMBER_BASE_MODULE_OPTIONS],
  },
] as Provider[];
