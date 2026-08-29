import type { CookieOptionsConfig, CookieSameSite } from '../utils/resolve-cookie-options';

/** Where the routes are mounted when nothing says otherwise. */
export const DEFAULT_REDIRECT_AUTH_ROUTE_PREFIX = 'auth';

/**
 * Mounted browser-redirect login routes for `kind: 'redirect'` providers.
 *
 * Supplying this object is the entire opt-in: with it absent no route is
 * registered, which is the same scope decision 0.8.0 made when
 * `OidcAdminController` was withdrawn — whether an endpoint exists, at what
 * path, and under whose authorization belongs to the host application.
 *
 * `OAuthCallbacksController` is untouched and keeps serving the older
 * `OAuth2Provider` channels at `/auth/login/:channel` and
 * `/auth/callbacks/:channel`.
 *
 * The two coexist with one exception. All four paths are three segments, and
 * the legacy controller is registered first, so under the default prefix a
 * channel literally named `login` or `callbacks` is shadowed: `/auth/login/start`
 * matches `/auth/login/:channel` first and reaches the OAuth2 handler with
 * `channel = 'start'`. The redirect provider is then unreachable. A warning is
 * logged on bootstrap if a registered channel would be shadowed; moving
 * `routePrefix` off `auth` avoids it entirely.
 */
export interface RedirectAuthOptions {
  /**
   * Path segment the two routes live under.
   * default: 'auth' — `GET /auth/:channel/start`, `GET /auth/:channel/callback`
   */
  routePrefix?: string;
  /**
   * Cookie holding the in-flight authorization request (state, PKCE verifier,
   * nonce, resolved returnTo).
   * default: 'oidc_tx'
   */
  txCookieName?: string;
  /**
   * How long that cookie lives, in seconds.
   * default: 600 — long enough to type a password and answer an MFA prompt,
   * short enough that an abandoned attempt does not linger.
   */
  txCookieMaxAge?: number;
  /**
   * Where the callback sends the browser when no allowed `returnTo` was given.
   * default: '/'
   */
  successRedirect?: string;
  /**
   * Destinations `?returnTo=` may name.
   *
   * Empty by default, which means `returnTo` is ignored entirely. Anything not
   * matched falls back to `successRedirect` rather than failing the login —
   * an unlisted destination is a configuration gap, not a reason to strand a
   * user who has just authenticated successfully.
   *
   * An entry is matched by origin and path prefix, so `https://app.example.com`
   * permits any path on that host and `myapp://auth` permits a native app's
   * custom scheme. A bare path (`/dashboard`) permits same-origin paths under
   * it. Nothing else is accepted — which is what stops the parameter from being
   * an open redirect.
   */
  allowedReturnTo?: string[];
  /** default: the module-level `accessTokenCookieName`. */
  accessTokenCookieName?: string;
  /** default: the module-level `refreshTokenCookieName`. */
  refreshTokenCookieName?: string;
  /** Per-attribute overrides of the module-level cookie configuration. */
  cookieOptions?: {
    path?: string;
    sameSite?: CookieSameSite;
    secure?: boolean;
    domain?: string;
  };
  /** default: the module-level `accessTokenExpiration`. */
  accessTokenExpiration?: number;
  /** default: the module-level `refreshTokenExpiration`. */
  refreshTokenExpiration?: number;
}

/** Everything the controller reads, with defaults already applied. */
export interface ResolvedRedirectAuthOptions {
  /**
   * Where the routes are actually mounted, or `null` when they are not mounted
   * at all.
   *
   * Nullable on purpose: this token is exported, and its stated job is to tell
   * a consumer building a login link where the routes are. In an application
   * that never enabled `redirectAuth` the honest answer is "nowhere", and a
   * plain `string` can only answer with a path that 404s.
   */
  routePrefix: string | null;
  txCookieName: string;
  txCookieMaxAge: number;
  successRedirect: string;
  allowedReturnTo: readonly string[];
  accessTokenCookieName: string;
  refreshTokenCookieName: string;
  cookieOptions: CookieOptionsConfig;
  accessTokenExpiration: number;
  refreshTokenExpiration: number;
}

/** The module-level values a redirectAuth block may override. */
export interface RedirectAuthDefaults {
  /**
   * The prefix the routes were actually mounted at, or null when they were not
   * mounted. Authoritative over the configured `routePrefix`, which cannot take
   * effect under `forRootAsync`.
   */
  mountedPrefix?: string | null;
  accessTokenCookieName: string;
  refreshTokenCookieName: string;
  cookieOptions: CookieOptionsConfig;
  accessTokenExpiration: number;
  refreshTokenExpiration: number;
}

export const resolveRedirectAuthOptions = (
  options: RedirectAuthOptions | undefined,
  defaults: RedirectAuthDefaults,
): ResolvedRedirectAuthOptions => ({
  // The mounted value is the only truth. `undefined` means the caller did not
  // say (the standalone helper, and tests), which falls back to the configured
  // value; `null` means the module decided not to mount, and is reported as-is.
  routePrefix:
    defaults.mountedPrefix === undefined
      ? (options?.routePrefix ?? DEFAULT_REDIRECT_AUTH_ROUTE_PREFIX)
      : defaults.mountedPrefix,
  txCookieName: options?.txCookieName ?? 'oidc_tx',
  txCookieMaxAge: options?.txCookieMaxAge ?? 600,
  successRedirect: options?.successRedirect ?? '/',
  allowedReturnTo: options?.allowedReturnTo ?? [],
  accessTokenCookieName: options?.accessTokenCookieName ?? defaults.accessTokenCookieName,
  refreshTokenCookieName: options?.refreshTokenCookieName ?? defaults.refreshTokenCookieName,
  cookieOptions: {
    ...defaults.cookieOptions,
    ...options?.cookieOptions,
  },
  accessTokenExpiration: options?.accessTokenExpiration ?? defaults.accessTokenExpiration,
  refreshTokenExpiration: options?.refreshTokenExpiration ?? defaults.refreshTokenExpiration,
});
