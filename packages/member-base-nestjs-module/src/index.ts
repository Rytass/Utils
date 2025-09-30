// Modules
export * from './member-base.module';

// Services
export * from './services/member-base.service';
export * from './services/member-base-admin.service';
export * from './services/password-validator.service';

// Models
export { BaseMemberEntity } from './models/base-member.entity';
export * from './models/member-login-log.entity';
export * from './models/member-password-history.entity';
export * from './models/member-oauth-record.entity';
export { BaseMemberRepo as BASE_MEMBER_REPOSITORY } from './models/base-member.entity';

// Tokens / Resolved Repositories
export {
  CASBIN_ENFORCER,
  RESOLVED_MEMBER_REPO,
  RESOLVED_MEMBER_REPO as RESOLVED_MEMBER_REPOSITORY,
  MEMBER_BASE_MODULE_OPTIONS,
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRATION,
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRATION,
  ENABLE_GLOBAL_GUARD,
  ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD,
  COOKIE_MODE,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from './typings/member-base.tokens';

// Types
export type { MemberBaseModuleOptions, MemberBaseModuleOptionsDTO } from './typings/member-base-module-options.dto';
export type {
  MemberBaseModuleAsyncOptions,
  MemberBaseModuleAsyncOptionsDTO,
} from './typings/member-base-module-async-options';
export type {
  MemberBaseOptionsFactory,
  MemberBaseModuleOptionFactoryInterface,
} from './typings/member-base-module-option-factory';
export type { AuthTokenPayloadBase } from './typings/auth-token-payload';

// Casbin
export * from './guards/casbin.guard';
export * from './decorators/action.decorator';
export * from './decorators/is-public.decorator';
export * from './decorators/member-id.decorator';
export * from './decorators/account.decorator';
export * from './decorators/authenticated.decorator';
export * from './decorators/has-permission.decorator';

// Helpers
export * from './helpers/graphql-context-token-resolver';

// Errors
export * from './constants/errors/index';

// Constants
export * from './constants/default-casbin-domain';
