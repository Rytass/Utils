import type { MemberBaseModuleOptionsDTO } from './member-base-module-options.dto';
import type { Enforcer } from 'casbin';
import type { AuthTokenPayloadBase } from './auth-token-payload';
import type { ReflectableDecorator } from '@nestjs/core';
import type { Subject, Action } from '../decorators/action.decorator';
import type { Repository } from 'typeorm';
import type { BaseMemberEntity } from '../models/base-member.entity';
import type { OAuth2Provider } from './oauth2-provider.interface';
import type { CasbinPermissionChecker } from './casbin-permission';
import type { CookieOptionsConfig } from '../utils/resolve-cookie-options';
import type {
  AuthenticationProvider,
  AutoProvisionStrategy,
  IdentitySyncHandler,
  LinkExistingAccountStrategy,
} from './authentication-provider.interface';
import type { PasswordHashOptions } from './password-hash-options';

// Typed injection tokens for better type safety (using Symbol with type annotations)
export const MEMBER_BASE_MODULE_OPTIONS = Symbol('MEMBER_BASE_MODULE_OPTIONS') as symbol & {
  __type: MemberBaseModuleOptionsDTO;
};
export const LOGIN_FAILED_BAN_THRESHOLD = Symbol('LOGIN_FAILED_BAN_THRESHOLD') as symbol & { __type: number };
export const RESET_PASSWORD_TOKEN_EXPIRATION = Symbol('RESET_PASSWORD_TOKEN_EXPIRATION') as symbol & { __type: number };
export const RESET_PASSWORD_TOKEN_SECRET = Symbol('RESET_PASSWORD_TOKEN_SECRET') as symbol & { __type: string };
export const CASBIN_ENFORCER = Symbol('CASBIN_ENFORCER') as symbol & { __type: Enforcer | null };
export const CASBIN_PERMISSION_DECORATOR = Symbol('CASBIN_PERMISSION_DECORATOR') as symbol & {
  __type: ReflectableDecorator<[Subject, Action][]>;
};
export const CASBIN_PERMISSION_CHECKER = Symbol('CASBIN_PERMISSION_CHECKER') as symbol & {
  __type: CasbinPermissionChecker<AuthTokenPayloadBase>;
};
export const ACCESS_TOKEN_SECRET = Symbol('ACCESS_TOKEN_SECRET') as symbol & { __type: string };
export const ACCESS_TOKEN_EXPIRATION = Symbol('ACCESS_TOKEN_EXPIRATION') as symbol & { __type: number };
export const REFRESH_TOKEN_SECRET = Symbol('REFRESH_TOKEN_SECRET') as symbol & { __type: string };
export const REFRESH_TOKEN_EXPIRATION = Symbol('REFRESH_TOKEN_EXPIRATION') as symbol & { __type: number };
export const ENABLE_GLOBAL_GUARD = Symbol('ENABLE_GLOBAL_GUARD') as symbol & { __type: boolean };
export const ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD = Symbol(
  'ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD',
) as symbol & { __type: boolean };
export const COOKIE_MODE = Symbol('COOKIE_MODE') as symbol & { __type: boolean };
export const LOGIN_FAILED_AUTO_UNLOCK_SECONDS = Symbol('LOGIN_FAILED_AUTO_UNLOCK_SECONDS') as symbol & {
  __type: number;
};
export const ACCESS_TOKEN_COOKIE_NAME = Symbol('ACCESS_TOKEN_COOKIE_NAME') as symbol & { __type: string };
export const REFRESH_TOKEN_COOKIE_NAME = Symbol('REFRESH_TOKEN_COOKIE_NAME') as symbol & { __type: string };
/**
 * Path, sameSite, secure and domain as configured, before the request is
 * consulted. One token rather than four: these are always read together, and
 * the two cookie-name tokens above are already public API that must not change.
 */
export const COOKIE_OPTIONS = Symbol('COOKIE_OPTIONS') as symbol & { __type: CookieOptionsConfig };

// Options Entity Providers
export const PROVIDE_MEMBER_ENTITY = Symbol('PROVIDE_MEMBER_ENTITY') as symbol & { __type: new () => BaseMemberEntity };

// Resolved Entity Repository Providers
export const RESOLVED_MEMBER_REPO = Symbol('RESOLVED_MEMBER_REPO') as symbol & { __type: Repository<BaseMemberEntity> };

// Password Policy Providers
export const PASSWORD_SHOULD_INCLUDE_UPPERCASE = Symbol('PASSWORD_SHOULD_INCLUDE_UPPERCASE') as symbol & {
  __type: boolean;
};
export const PASSWORD_SHOULD_INCLUDE_LOWERCASE = Symbol('PASSWORD_SHOULD_INCLUDE_LOWERCASE') as symbol & {
  __type: boolean;
};
export const PASSWORD_SHOULD_INCLUDE_DIGIT = Symbol('PASSWORD_SHOULD_INCLUDE_DIGIT') as symbol & {
  __type: boolean;
};
export const PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER = Symbol(
  'PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER',
) as symbol & {
  __type: boolean;
};
export const PASSWORD_MIN_LENGTH = Symbol('PASSWORD_MIN_LENGTH') as symbol & {
  __type: number;
};
export const PASSWORD_POLICY_REGEXP = Symbol('PASSWORD_POLICY_REGEXP') as symbol & {
  __type: RegExp;
};
export const PASSWORD_HISTORY_LIMIT = Symbol('PASSWORD_HISTORY_LIMIT') as symbol & {
  __type: number;
};
export const PASSWORD_AGE_LIMIT_IN_DAYS = Symbol('PASSWORD_AGE_LIMIT_IN_DAYS') as symbol & {
  __type: number;
};
export const FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED = Symbol('FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED') as symbol & {
  __type: boolean;
};
export const CUSTOMIZED_JWT_PAYLOAD = Symbol('CUSTOMIZED_JWT_PAYLOAD') as symbol & { __type: Function };

// OAuth2 Providers
export const OAUTH2_PROVIDERS = Symbol('OAUTH2_PROVIDERS') as symbol & { __type: OAuth2Provider[] };
export const OAUTH2_CLIENT_DEST_URL = Symbol('OAUTH2_CLIENT_DEST_URL') as symbol & { __type: string };

// Authentication Gateway
export const AUTH_PROVIDERS = Symbol('AUTH_PROVIDERS') as symbol & { __type: AuthenticationProvider[] };
export const AUTO_PROVISION = Symbol('AUTO_PROVISION') as symbol & { __type: AutoProvisionStrategy };
export const LINK_EXISTING_ACCOUNT = Symbol('LINK_EXISTING_ACCOUNT') as symbol & {
  __type: LinkExistingAccountStrategy;
};
export const SYNC_ON_AUTHENTICATE = Symbol('SYNC_ON_AUTHENTICATE') as symbol & {
  __type: IdentitySyncHandler | null;
};

// Default Admin Providers
export const DEFAULT_ADMIN_ACCOUNT = Symbol('DEFAULT_ADMIN_ACCOUNT') as symbol & { __type: string | null };
export const DEFAULT_ADMIN_PASSWORD = Symbol('DEFAULT_ADMIN_PASSWORD') as symbol & { __type: string | null };

/** argon2 cost parameters. Empty object means the library's own defaults. */
export const PASSWORD_HASH_OPTIONS = Symbol('PASSWORD_HASH_OPTIONS') as symbol & { __type: PasswordHashOptions };

// Casbin naming. Resolved through DI rather than read from the exported
// constants, so a deployment whose policy table already uses these strings for
// something else can move the module out of the way.
export const SUPER_ADMIN_ROLE_NAME = Symbol('SUPER_ADMIN_ROLE_NAME') as symbol & { __type: string };
export const DEFAULT_CASBIN_DOMAIN_NAME = Symbol('DEFAULT_CASBIN_DOMAIN_NAME') as symbol & { __type: string };

export const LOGIN_LOG_ENABLED = Symbol('LOGIN_LOG_ENABLED') as symbol & { __type: boolean };
export const LOGIN_LOG_RECORD_IP = Symbol('LOGIN_LOG_RECORD_IP') as symbol & { __type: boolean };

// Provider types mapping for enhanced type safety
export interface MemberBaseProviders {
  MEMBER_BASE_MODULE_OPTIONS: MemberBaseModuleOptionsDTO;
  LOGIN_FAILED_BAN_THRESHOLD: number;
  RESET_PASSWORD_TOKEN_EXPIRATION: number;
  RESET_PASSWORD_TOKEN_SECRET: string;
  CASBIN_ENFORCER: Enforcer;
  CASBIN_PERMISSION_DECORATOR: ReflectableDecorator<[Subject, Action][]>;
  CASBIN_PERMISSION_CHECKER: Function;
  ACCESS_TOKEN_SECRET: string;
  ACCESS_TOKEN_EXPIRATION: number;
  REFRESH_TOKEN_SECRET: string;
  REFRESH_TOKEN_EXPIRATION: number;
  ENABLE_GLOBAL_GUARD: boolean;
  ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD: boolean;
  COOKIE_MODE: boolean;
  LOGIN_FAILED_AUTO_UNLOCK_SECONDS: number;
  ACCESS_TOKEN_COOKIE_NAME: string;
  REFRESH_TOKEN_COOKIE_NAME: string;
  COOKIE_OPTIONS: CookieOptionsConfig;
  PROVIDE_MEMBER_ENTITY: new () => BaseMemberEntity;
  RESOLVED_MEMBER_REPO: Repository<BaseMemberEntity>;
  PASSWORD_SHOULD_INCLUDE_UPPERCASE: boolean;
  PASSWORD_SHOULD_INCLUDE_LOWERCASE: boolean;
  PASSWORD_SHOULD_INCLUDE_DIGIT: boolean;
  PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER: boolean;
  PASSWORD_MIN_LENGTH: number;
  PASSWORD_POLICY_REGEXP: RegExp;
  PASSWORD_HISTORY_LIMIT: number;
  PASSWORD_AGE_LIMIT_IN_DAYS: number;
  FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED: boolean;
  CUSTOMIZED_JWT_PAYLOAD: Function;
  OAUTH2_PROVIDERS: OAuth2Provider[];
  OAUTH2_CLIENT_DEST_URL: string;
  AUTH_PROVIDERS: AuthenticationProvider[];
  AUTO_PROVISION: AutoProvisionStrategy;
  LINK_EXISTING_ACCOUNT: LinkExistingAccountStrategy;
  SYNC_ON_AUTHENTICATE: IdentitySyncHandler | null;
  DEFAULT_ADMIN_ACCOUNT: string | null;
  DEFAULT_ADMIN_PASSWORD: string | null;
  PASSWORD_HASH_OPTIONS: PasswordHashOptions;
  SUPER_ADMIN_ROLE_NAME: string;
  DEFAULT_CASBIN_DOMAIN_NAME: string;
  LOGIN_LOG_ENABLED: boolean;
  LOGIN_LOG_RECORD_IP: boolean;
}

export type MemberBaseProviderToken = keyof MemberBaseProviders;
