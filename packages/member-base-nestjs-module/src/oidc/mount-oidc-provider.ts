import { ApplicationConfig } from '@nestjs/core';
import { OIDC_PROVIDER_INSTANCE, OIDC_ROUTE_PREFIX } from './oidc.tokens';
import type { OidcProviderLike } from './oidc.factory';

/** Sub-path the interaction controllers are routed on, relative to the prefix. */
const INTERACTION_PATH = '/interaction';

interface MountedRequest {
  url?: string;
}

interface NestApplicationLike {
  get<T>(token: unknown, options?: { strict?: boolean }): T;
  use(...handlers: unknown[]): unknown;
}

/**
 * Strip the mount path, or return null when the request is not for us.
 *
 * `/oidcfoo` must not read as a request to `/oidc`, so the remainder has to
 * start a new path segment or the query string.
 */
const stripMountPath = (url: string | undefined, mountPath: string): string | null => {
  if (typeof url !== 'string' || !url.startsWith(mountPath)) return null;

  const rest = url.slice(mountPath.length);

  if (rest === '') return '/';

  if (rest.startsWith('?')) return `/${rest}`;

  return rest.startsWith('/') ? rest : null;
};

/**
 * Nest's own global prefix, normalised to a leading slash.
 *
 * Controller routes carry it, but `app.use` middleware runs ahead of Nest's
 * router and sees the unmodified URL, so the interaction rewrite below has to
 * put the prefix back or the request lands on a route that is registered
 * somewhere else. Read defensively: this is only an optimisation of last
 * resort, and an application without a global prefix must not pay for it.
 */
const readGlobalPrefix = (app: NestApplicationLike): string => {
  try {
    const config = app.get<{ getGlobalPrefix?: () => string }>(ApplicationConfig, { strict: false });
    const prefix = config?.getGlobalPrefix?.() ?? '';

    if (!prefix || prefix === '/') return '';

    return prefix.startsWith('/') ? prefix : `/${prefix}`;
  } catch {
    return '';
  }
};

/**
 * Mount the OIDC protocol endpoints.
 *
 * This cannot be a Nest controller. oidc-provider is a Koa application that
 * reads the raw request stream via raw-body; middleware registered through
 * `configure(consumer)` runs *after* Nest's body parser, which has already
 * consumed that stream, and every form-encoded POST (/token, /introspection,
 * /revocation) breaks. Mounting from main.ts, before `listen()`, puts the
 * provider ahead of the body parser where it can read the stream itself.
 *
 * ```ts
 * const app = await NestFactory.create(AppModule);
 *
 * mountMemberBaseOidcProvider(app);   // before listen()
 *
 * await app.listen(3000);
 * ```
 *
 * Endpoints then live under the configured prefix (default `oidc`):
 * `/oidc/.well-known/openid-configuration`, `/oidc/auth`, `/oidc/token`,
 * `/oidc/me`, `/oidc/jwks`, `/oidc/session/end`.
 *
 * Requests under `/<prefix>/interaction` are passed through to Nest rather than
 * to the provider: those pages are controllers in this module, and letting the
 * provider answer them would 404 the screens the flow redirects users to.
 *
 * The middleware is registered without a mount path on purpose. `app.use(path,
 * handler)` makes Express strip the path for the handler and then put it back
 * before the request reaches the next layer — which would hand Nest
 * `/oidc/interaction/<uid>` while the controller is registered on
 * `/interaction/<uid>`, and every interaction would 404. Stripping it here
 * instead makes the rewrite outlive the middleware.
 *
 * Requires `cookie-parser` to be registered on the app when the SSO bridge is
 * enabled, since the bridge reads the member-base session cookie.
 */
export const mountMemberBaseOidcProvider = (app: NestApplicationLike): void => {
  const provider = app.get<OidcProviderLike>(OIDC_PROVIDER_INSTANCE, { strict: false });
  const routePrefix = app.get<string>(OIDC_ROUTE_PREFIX, { strict: false });
  const handleProtocol = provider.callback();
  const mountPath = `/${routePrefix}`;
  const globalPrefix = readGlobalPrefix(app);

  app.use((req: MountedRequest, res: unknown, next: () => void): void => {
    const mounted = stripMountPath(req.url, mountPath);

    if (mounted === null) {
      next();

      return;
    }

    // The interaction pages are Nest controllers, not provider endpoints.
    // Handing them to the provider would 404 the very screens the flow
    // redirects users to, so they are passed through to Nest's router.
    if (mounted === INTERACTION_PATH || mounted.startsWith(`${INTERACTION_PATH}/`)) {
      req.url = `${globalPrefix}${mounted}`;

      next();

      return;
    }

    // The provider derives its own URLs from the issuer, which already carries
    // the prefix, so it must see the path without it.
    req.url = mounted;

    handleProtocol(req, res);
  });
};
