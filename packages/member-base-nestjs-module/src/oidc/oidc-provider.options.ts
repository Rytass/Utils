import type { ModuleMetadata, Type } from '@nestjs/common';
import type { BaseMemberEntity } from '../models/base-member.entity';

/** What the redirect target is told about the interaction it has to resolve. */
export interface OidcInteractionPageParams {
  uid: string;
  promptName: string;
  promptReasons: readonly string[];
  clientId: string;
  /** The original authorization request parameters, notably `prompt` and `max_age`. */
  params: Record<string, unknown>;
  /** Set when the browser is being sent back after a failed submission. */
  error?: string;
}

/**
 * Where the browser is sent when an interaction needs the end user.
 *
 * A string is used as-is with `uid`, `prompt` and `client_id` appended to its
 * query (any query it already carries is kept); a function is handed the whole
 * of {@link OidcInteractionPageParams} and decides for itself.
 */
export type OidcInteractionPageUrl = string | ((params: OidcInteractionPageParams) => string);

/** Everything the consent page needs to describe what is being asked for. */
export interface OidcConsentRenderParams {
  uid: string;
  clientId: string;
  clientName: string;
  missingScopes: readonly string[];
  missingClaims: readonly string[];
  missingResourceScopes: Readonly<Record<string, readonly string[]>>;
  /** Absolute path the approval must be posted to. */
  submitUrl: string;
  /** Absolute path a refusal must be posted to. */
  abortUrl: string;
}

export interface OidcLoginRenderParams {
  uid: string;
  channels: readonly string[];
  error?: string;
  /** Absolute path the credentials must be posted to. */
  submitUrl: string;
}

/**
 * How the end user is asked to log in and to consent.
 *
 * This package is a backend module: the intended arrangement is that the
 * application owns those two pages and their URLs, and drives the interaction
 * through the JSON API under `/<routePrefix>/interaction/<uid>`. Rendering HTML
 * in-process is the fallback, and the built-in pages are a development
 * convenience that logs a warning when they are reached.
 *
 * Resolution order is `loginPageUrl` → `renderLogin` → built-in page, and the
 * same for consent.
 */
export interface OidcInteractionOptions {
  /** The application's own login page. Preferred over `renderLogin`. */
  loginPageUrl?: OidcInteractionPageUrl;

  /** The application's own consent page. Preferred over `renderConsent`. */
  consentPageUrl?: OidcInteractionPageUrl;

  /**
   * Render the login page in-process. Receives the interaction uid, the
   * channels the gateway has registered, an error message on a retry, and the
   * path the credentials have to be posted to.
   *
   * Secondary to `loginPageUrl`, and ignored when that is set.
   */
  renderLogin?: (params: OidcLoginRenderParams) => string;

  /**
   * Render the consent page in-process.
   *
   * Secondary to `consentPageUrl`, and ignored when that is set.
   */
  renderConsent?: (params: OidcConsentRenderParams) => string;

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
