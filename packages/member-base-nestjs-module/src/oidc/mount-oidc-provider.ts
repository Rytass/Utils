import { OIDC_PROVIDER_INSTANCE, OIDC_ROUTE_PREFIX } from './oidc.tokens';
import type { OidcProviderLike } from './oidc.factory';

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
 * The interaction pages are ordinary controllers and are already routed by
 * Nest, so they need nothing here.
 */
export const mountMemberBaseOidcProvider = (app: NestApplicationLike): void => {
  const provider = app.get<OidcProviderLike>(OIDC_PROVIDER_INSTANCE, { strict: false });
  const routePrefix = app.get<string>(OIDC_ROUTE_PREFIX, { strict: false });

  app.use(`/${routePrefix}`, provider.callback());
};
