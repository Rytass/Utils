/**
 * OAuth 2.0 client credentials — the standard way to authenticate a Fusion integration user.
 *
 * This is the default strategy: `type` may be omitted entirely.
 * Tokens are cached and refreshed `refreshBufferMs` before expiry.
 */
export interface FusionOAuth2AuthConfig {
  readonly type?: 'oauth2_client_credentials';
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  /**
   * OAuth scope. The wire format is a single space-delimited string (RFC 6749 section 3.3);
   * an array is joined with spaces for you.
   */
  readonly scope?: string | readonly string[];
  /** Refresh window before expiry, in milliseconds. Defaults to 60000. */
  readonly refreshBufferMs?: number;
}

/**
 * A JWT issued by an identity provider Fusion trusts, sent as `Authorization: Bearer <token>`.
 *
 * Use this when tokens are obtained outside this package — an SSO flow, a federated identity
 * provider, or an OAuth grant this package does not implement (such as the JWT assertion grant).
 *
 * `token` may be a function so short-lived tokens can be refreshed per request. The function is
 * invoked on every call, so implement caching there if minting is expensive.
 */
export interface FusionJwtAuthConfig {
  readonly type: 'jwt';
  readonly token: string | (() => Promise<string> | string);
}

/**
 * HTTP Basic with a Fusion user's credentials. Accepted by Fusion REST endpoints and commonly
 * used against test pods, but unsuitable for production: the password travels on every request,
 * cannot be rotated independently and ties the integration to a single named user.
 */
export interface FusionBasicAuthConfig {
  readonly type: 'basic';
  readonly username: string;
  readonly password: string;
}

/**
 * Authentication strategies supported by Oracle Fusion REST APIs.
 *
 * Fusion protects its REST endpoints with the `oracle/multi_token_over_ssl_rest_service_policy`
 * OWSM policy, which accepts OAuth 2.0, JWT, SAML 2.0 bearer tokens and HTTP Basic over SSL.
 * SAML bearer assertions are not implemented here; obtain the token yourself and pass it through
 * the `jwt` strategy if your identity provider issues one Fusion accepts.
 */
export type FusionAuthConfig = FusionOAuth2AuthConfig | FusionJwtAuthConfig | FusionBasicAuthConfig;

/** Internal: `type` is always present after normalisation, so switches stay exhaustive. */
export type ResolvedFusionAuthConfig =
  | (FusionOAuth2AuthConfig & { readonly type: 'oauth2_client_credentials' })
  | FusionJwtAuthConfig
  | FusionBasicAuthConfig;

/** Fills in the default strategy when `type` is omitted. */
export function normalizeAuthConfig(auth: FusionAuthConfig): ResolvedFusionAuthConfig {
  if (auth.type === 'basic' || auth.type === 'jwt') return auth;

  return { ...auth, type: 'oauth2_client_credentials' };
}
