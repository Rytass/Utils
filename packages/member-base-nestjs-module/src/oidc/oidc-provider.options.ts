import type { ModuleMetadata, Type } from '@nestjs/common';
import type { BaseMemberEntity } from '../models/base-member.entity';

export interface OidcInteractionOptions {
  /**
   * Render the login page. Receives the interaction uid, the channels the
   * gateway has registered, and an error message on a retry.
   *
   * A deliberately plain built-in page is used when omitted.
   */
  renderLogin?: (params: { uid: string; channels: readonly string[]; error?: string }) => string;

  /**
   * Which gateway channels the login form may authenticate against.
   * default: every registered channel.
   */
  allowedChannels?: string[];

  /**
   * Grant consent without prompting.
   * default: honours the client's own `skipConsent` column.
   */
  autoConsent?: boolean | ((clientId: string) => boolean | Promise<boolean>);
}

export interface OidcClaimsOptions {
  /**
   * Extra claims to publish for a member.
   *
   * Authorization is deliberately NOT modelled here: this issuer proves who a
   * subject is, and each service provider decides what that subject may do.
   * Emitting roles would move that decision into a token whose lifetime the
   * providers cannot control.
   */
  extra?: (member: BaseMemberEntity) => Record<string, unknown> | Promise<Record<string, unknown>>;

  /** Additional scope names accepted on an authorization request. */
  additionalScopes?: string[];

  /** Which claims each scope releases. */
  scopeClaims?: Record<string, string[]>;
}

export interface OidcSsoBridgeOptions {
  /** default: true whenever the provider module is imported. */
  enabled?: boolean;
  /** Issue member-base cookies when a member logs in through the interaction. */
  issueLocalSession?: boolean;
  /** Treat a valid member-base access token as an authenticated OIDC session. */
  acceptLocalSession?: boolean;
  /** Clear both sessions on logout. */
  unifiedLogout?: boolean;
}

export interface MemberBaseOidcProviderOptions {
  /** Issuer identifier. Must match the public URL the endpoint is served on. */
  issuer: string;

  /**
   * JWKS used to sign id tokens. Generated at boot with a loud warning when
   * omitted, which is only viable in development: a restart invalidates every
   * token issued, and multiple instances would sign with different keys.
   */
  jwks?: { keys: Record<string, unknown>[] };

  /** Keys protecting the provider's own cookies. */
  cookieKeys?: string[];

  /** Path the provider is mounted on. default: 'oidc' */
  routePrefix?: string;

  interaction?: OidcInteractionOptions;
  claims?: OidcClaimsOptions;
  ssoBridge?: OidcSsoBridgeOptions;

  /** Token lifetimes in seconds. */
  ttl?: Partial<Record<'AccessToken' | 'AuthorizationCode' | 'IdToken' | 'RefreshToken' | 'Session' | 'Grant', number>>;

  /**
   * How often expired artefacts are swept, in seconds. 0 disables the sweep,
   * which then has to be driven by the application.
   * default: 3600
   */
  purgeIntervalSeconds?: number;

  /** Escape hatch merged last into the oidc-provider configuration. */
  advanced?: Record<string, unknown>;
}

export interface MemberBaseOidcProviderAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (...args: never[]) => Promise<MemberBaseOidcProviderOptions> | MemberBaseOidcProviderOptions;
  inject?: unknown[];
  useClass?: Type<MemberBaseOidcProviderOptionsFactory>;
  useExisting?: Type<MemberBaseOidcProviderOptionsFactory>;
}

export interface MemberBaseOidcProviderOptionsFactory {
  createOidcProviderOptions(): Promise<MemberBaseOidcProviderOptions> | MemberBaseOidcProviderOptions;
}
