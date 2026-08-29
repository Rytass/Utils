// Modules
export * from './member-base.module';

// Services
export * from './services/member-base.service';
export * from './services/member-base-admin.service';
export * from './services/password-validator.service';
export * from './services/oauth.service';
export { AuthenticationGateway, type AuthenticationResult } from './services/authentication-gateway.service';

// Authentication Providers
export { PasswordAuthProvider, type PasswordCredentials } from './providers/password-auth.provider';
export { PASSWORD_CHANNEL } from './constants/password-channel';
export { OidcAuthProvider, type OidcAuthProviderOptions } from './providers/oidc/oidc-auth.provider';
export { OidcMetadataResolver, type OidcDiscoveryDocument } from './providers/oidc/oidc-discovery';

// Models
export { BaseMemberEntity } from './models/base-member.entity';
export * from './models/member-login-log.entity';
export * from './models/member-password-history.entity';
export * from './models/member-oauth-record.entity';
export * from './models/member-external-identity.entity';
// Both names, matching RESOLVED_MEMBER_REPO below: the alias was added without
// withdrawing the original, and exporting only the alias made the original
// unimportable from the package root.
export { BaseMemberRepo, BaseMemberRepo as BASE_MEMBER_REPOSITORY } from './models/base-member.entity';

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
  COOKIE_OPTIONS,
  AUTH_PROVIDERS,
  AUTO_PROVISION,
  LINK_EXISTING_ACCOUNT,
  SYNC_ON_AUTHENTICATE,
  PASSWORD_HASH_OPTIONS,
  SUPER_ADMIN_ROLE_NAME,
  DEFAULT_CASBIN_DOMAIN_NAME,
  LOGIN_LOG_ENABLED,
  LOGIN_LOG_RECORD_IP,
  REDIRECT_AUTH_OPTIONS,
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
export type { PasswordHashOptions } from './typings/password-hash-options';
export type { SignTokenOptions } from './typings/sign-token-options';
export type {
  AuthContext,
  AuthenticatedIdentity,
  AuthenticationProvider,
  AuthorizationRequest,
  AuthProviderKind,
  AutoProvisionStrategy,
  IdentitySyncHandler,
  LinkExistingAccountStrategy,
} from './typings/authentication-provider.interface';
export type {
  DirectoryEntry,
  DirectoryIdentityAttributes,
  DirectoryListOptions,
  DirectoryProvider,
  DirectoryDeltaResult,
  DirectoryRemovedEntry,
  DirectoryRemovalReason,
} from './typings/directory-provider.interface';
export { isDirectoryProvider } from './typings/directory-provider.interface';
export type {
  RedirectAuthOptions,
  ResolvedRedirectAuthOptions,
  RedirectAuthDefaults,
} from './typings/redirect-auth.options';
export { DEFAULT_REDIRECT_AUTH_ROUTE_PREFIX, resolveRedirectAuthOptions } from './typings/redirect-auth.options';
export type {
  CasbinPermissionCheckerParams,
  CasbinPermissionChecker,
  CasbinPermissionCheckerResult,
  CasbinPermissionCheckerSyncResult,
  CasbinAuthorizationDecision,
  CasbinDomainResolver,
  CasbinDomainResolverParams,
} from './typings/casbin-permission';

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
export { normalizeCasbinDecision } from './utils/normalize-casbin-decision';
export { resolveReturnTo } from './utils/resolve-return-to';
export { toInetCidr } from './utils/to-inet-cidr';
export {
  resolveCookieOptions,
  type CookieOptionsConfig,
  type ResolvedCookieOptions,
  type CookieSameSite,
} from './utils/resolve-cookie-options';

// Errors
export * from './constants/errors/index';
// The five ways CasbinGuard denies, exported by name so an application can tell
// them apart with instanceof instead of comparing an exception message.
export {
  MissingAccessTokenError,
  InvalidAccessTokenError,
  PermissionDeniedError,
  RouteMissingPermissionMetadataError,
  CasbinEnforcerUnavailableError,
} from './constants/errors/base.error';
// Raised by the directory readers and by the mounted redirect login routes.
export {
  DirectoryRequestFailedError,
  RedirectAuthTransactionError,
  RedirectAuthDeniedError,
} from './constants/errors/base.error';

// Redirect login routes (registered only when `redirectAuth` is configured).
// The class is exported as a TYPE only: it carries a bare @Controller(), so
// putting it in an application's own `controllers` array would mount
// GET /:channel/start and GET /:channel/callback at the application root — two
// greedy two-segment routes that work well enough for nobody to notice. The
// factory is the supported way to mount it at a path.
export { createRedirectAuthController } from './controllers/redirect-auth.controller';
export type { RedirectAuthController } from './controllers/redirect-auth.controller';

// Constants
export {
  createDefaultPermissionChecker,
  type DefaultPermissionCheckerNames,
} from './constants/default-permission-checker';
export * from './constants/default-casbin-domain';
export * from './constants/super-admin-role';
