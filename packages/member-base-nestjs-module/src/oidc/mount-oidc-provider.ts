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
 * mountMemberBaseOidcProvider(app);   // before any global prefix or listen()
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
 * Requires `cookie-parser` to be registered on the app when the SSO bridge is
 * enabled, since the bridge reads the member-base session cookie.
 */
export const mountMemberBaseOidcProvider = (app: NestApplicationLike): void => {
  const provider = app.get<OidcProviderLike>(OIDC_PROVIDER_INSTANCE, { strict: false });
  const routePrefix = app.get<string>(OIDC_ROUTE_PREFIX, { strict: false });
  const handleProtocol = provider.callback();

  app.use(`/${routePrefix}`, (req: MountedRequest, res: unknown, next: () => void): void => {
    // The interaction pages are Nest controllers, not provider endpoints.
    // Handing them to the provider would 404 the very screens the flow
    // redirects users to, so they are passed through to Nest's router.
    if (typeof req.url === 'string' && req.url.startsWith(INTERACTION_PATH)) {
      next();

      return;
    }

    handleProtocol(req, res);
  });
};
