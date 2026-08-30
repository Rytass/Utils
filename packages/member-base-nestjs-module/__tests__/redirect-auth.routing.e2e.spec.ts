import { CanActivate, ExecutionContext, Injectable, Module, type INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createRedirectAuthController } from '../src/controllers/redirect-auth.controller';
import { IS_ROUTE_PUBLIC } from '../src/decorators/is-public.decorator';
import { AuthenticationGateway } from '../src/services/authentication-gateway.service';
import { MemberBaseService } from '../src/services/member-base.service';
import { COOKIE_MODE, REDIRECT_AUTH_OPTIONS } from '../src/typings/member-base.tokens';
import { resolveRedirectAuthOptions } from '../src/typings/redirect-auth.options';
import type { AuthenticationProvider } from '../src/typings/authentication-provider.interface';

/**
 * The one thing the rest of the suite cannot prove.
 *
 * `createRedirectAuthController` applies a configurable path by subclassing a
 * decorated base class, which works only because Nest walks the prototype chain
 * for route handlers, for constructor `@Inject()` metadata, and for the
 * `@IsPublic()` marker `CasbinGuard` reads. Every one of those is a framework
 * behaviour, not one of ours — so asserting the metadata, as the unit specs do,
 * restates the mechanism rather than exercising it, and a Nest major version
 * could change it without turning anything red.
 *
 * This boots a real application and issues real requests instead.
 */

const AUTHORIZATION_URL = 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?state=state-1';

const redirectProvider = (): AuthenticationProvider =>
  ({
    channel: 'entra',
    kind: 'redirect',
    createAuthorizationRequest: async () => ({
      url: AUTHORIZATION_URL,
      state: 'state-1',
      codeVerifier: 'verifier-1',
      nonce: 'nonce-1',
    }),
  }) as unknown as AuthenticationProvider;

const gateway = {
  getProvider: jest.fn(() => redirectProvider()),
  listProviders: jest.fn(() => [redirectProvider()]),
  handleCallback: jest.fn(async () => ({ member: { id: 'member-1' }, identity: { channel: 'entra' } })),
  getAuthorizationUrl: jest.fn(async () => AUTHORIZATION_URL),
};

const memberBaseService = {
  signAccessToken: jest.fn(() => 'access-token'),
  signRefreshToken: jest.fn(() => 'refresh-token'),
};

/**
 * Stands in for `CasbinGuard` to prove `@IsPublic()` survives the subclassing.
 *
 * Reads the marker exactly the way the real guard does — off the handler, via
 * Reflector — and denies anything not marked, so a route whose decorator did
 * not survive inheritance answers 403 instead of quietly passing.
 */
@Injectable()
class PublicOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    return this.reflector.get<boolean>(IS_ROUTE_PUBLIC, context.getHandler()) === true;
  }
}

/**
 * Populates `req.cookies` the way `cookie-parser` would.
 *
 * Deliberately hand-rolled rather than pulled in as a dependency: this module
 * does not require `cookie-parser`, and both code paths need covering — with it
 * the controller reads `req.cookies`, without it the raw `Cookie` header. An
 * application that never installed the middleware has to work.
 */
const parseCookies = (
  req: { headers: Record<string, unknown>; cookies?: Record<string, string> },
  _res: unknown,
  next: () => void,
): void => {
  const header = req.headers.cookie;

  req.cookies =
    typeof header !== 'string'
      ? {}
      : Object.fromEntries(
          header
            .split(';')
            .map(part => part.trim())
            .filter(Boolean)
            .map(part => {
              const separator = part.indexOf('=');

              return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
            }),
        );

  next();
};

const buildApp = async (
  routePrefix: string,
  cookieMode: boolean,
  options?: {
    withCookieParser?: boolean;
    allowedReturnTo?: (string | { url: string; delivery?: 'cookie' | 'fragment' })[];
  },
): Promise<INestApplication> => {
  @Module({
    controllers: [createRedirectAuthController(routePrefix)],
    providers: [
      { provide: APP_GUARD, useClass: PublicOnlyGuard },
      {
        provide: REDIRECT_AUTH_OPTIONS,
        useValue: resolveRedirectAuthOptions(
          {
            allowedReturnTo: options?.allowedReturnTo ?? ['https://app.example.com'],
            successRedirect: '/home',
          },
          {
            mountedPrefix: routePrefix,
            accessTokenCookieName: 'access_token',
            refreshTokenCookieName: 'refresh_token',
            cookieOptions: { path: '/', sameSite: 'lax' },
            accessTokenExpiration: 900,
            refreshTokenExpiration: 7_776_000,
          },
        ),
      },
      { provide: AuthenticationGateway, useValue: gateway },
      { provide: MemberBaseService, useValue: memberBaseService },
      { provide: COOKIE_MODE, useValue: cookieMode },
    ],
  })
  class RoutingTestModule {}

  const app = (await Test.createTestingModule({ imports: [RoutingTestModule] }).compile()).createNestApplication();

  if (options?.withCookieParser) {
    app.use(parseCookies);
  }

  await app.init();

  return app;
};

describe('mounted redirect routes, over real HTTP', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
    jest.clearAllMocks();
  });

  it('should route a browser to the issuer and set the transaction cookie', async () => {
    app = await buildApp('sso', true);

    const response = await request(app.getHttpServer()).get('/sso/entra/start').set('accept', 'text/html').expect(302);

    expect(response.headers.location).toBe(AUTHORIZATION_URL);

    const cookie = (response.headers['set-cookie'] as unknown as string[]).find(value => value.startsWith('oidc_tx='));

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    // The channel really came out of the path parameter, not a constant.
    expect(gateway.getProvider).toHaveBeenCalledWith('entra');
  });

  it('should answer an api client with the location as data', async () => {
    app = await buildApp('sso', true);

    const response = await request(app.getHttpServer()).get('/sso/entra/start').set('accept', '*/*').expect(200);

    expect(response.body).toEqual({ redirectTo: AUTHORIZATION_URL });
  });

  it('should complete a callback end to end and issue the session cookies', async () => {
    app = await buildApp('sso', true);

    const agent = request.agent(app.getHttpServer());

    await agent.get('/sso/entra/start').set('accept', 'text/html').expect(302);

    const response = await agent
      .get('/sso/entra/callback')
      .query({ code: 'code-1', state: 'state-1', returnTo: 'ignored' })
      .set('accept', 'text/html')
      .expect(302);

    expect(gateway.handleCallback).toHaveBeenCalledWith(
      'entra',
      { code: 'code-1', codeVerifier: 'verifier-1', nonce: 'nonce-1' },
      expect.objectContaining({ ip: expect.any(String) }),
    );

    const names = (response.headers['set-cookie'] as unknown as string[]).map(value => value.split('=')[0]);

    expect(names).toContain('access_token');
    expect(names).toContain('refresh_token');
    expect(response.headers.location).toBe('/home');
  });

  it('should reject a forged state with 400, not 500', async () => {
    app = await buildApp('sso', true);

    const agent = request.agent(app.getHttpServer());

    await agent.get('/sso/entra/start').set('accept', 'text/html').expect(302);

    await agent
      .get('/sso/entra/callback')
      .query({ code: 'code-1', state: 'forged' })
      .set('accept', 'text/html')
      .expect(400);

    expect(gateway.handleCallback).not.toHaveBeenCalled();
  });

  it('should answer 400 rather than 500 for a malformed transaction cookie', async () => {
    app = await buildApp('sso', true);

    // decodeURIComponent throws URIError on this, and the header is entirely
    // caller-controlled — a real request is the only way to prove it does not
    // escape the handler as an unauthenticated 500.
    await request(app.getHttpServer())
      .get('/sso/entra/callback')
      .query({ code: 'code-1', state: 'state-1' })
      .set('cookie', 'oidc_tx=%')
      .set('accept', 'text/html')
      .expect(400);
  });

  it('should not answer at another prefix', async () => {
    app = await buildApp('sso', true);

    await request(app.getHttpServer()).get('/auth/entra/start').set('accept', 'text/html').expect(404);
  });

  it('should mount wherever the factory was told to', async () => {
    app = await buildApp('api/auth', true);

    await request(app.getHttpServer()).get('/api/auth/entra/start').set('accept', 'text/html').expect(302);
  });

  it('should carry the tokens on the destination when cookieMode is off', async () => {
    app = await buildApp('sso', false);

    const agent = request.agent(app.getHttpServer());

    await agent.get('/sso/entra/start?returnTo=https://app.example.com/dash').set('accept', 'text/html').expect(302);

    const response = await agent
      .get('/sso/entra/callback')
      .query({ code: 'code-1', state: 'state-1' })
      .set('accept', 'text/html')
      .expect(302);

    // The transaction cookie is still cleared — that has to happen on every
    // path — but no session cookie is written, because with cookieMode off the
    // guard would never read one back.
    const written = (response.headers['set-cookie'] as unknown as string[]).map(value => value.split('=')[0]);

    expect(written).toEqual(['oidc_tx']);
    expect(response.headers.location).toBe(
      'https://app.example.com/dash?accessToken=access-token&refreshToken=refresh-token',
    );
  });

  it('should read the transaction through cookie-parser when the host installed it', async () => {
    app = await buildApp('sso', true, { withCookieParser: true });

    const agent = request.agent(app.getHttpServer());

    await agent.get('/sso/entra/start').set('accept', 'text/html').expect(302);

    // The other branch: every test above runs without the middleware and
    // therefore exercises the raw Cookie header fallback instead.
    await agent
      .get('/sso/entra/callback')
      .query({ code: 'code-1', state: 'state-1' })
      .set('accept', 'text/html')
      .expect(302);

    expect(gateway.handleCallback).toHaveBeenCalled();
  });

  it('should carry @IsPublic() through the subclass to the guard', async () => {
    // The stand-in guard denies anything not marked public, so a 302 here is
    // the decorator being found on the inherited handler — which is where
    // CasbinGuard looks. If inheritance dropped it, this would be 403.
    app = await buildApp('sso', true);

    await request(app.getHttpServer()).get('/sso/entra/start').set('accept', 'text/html').expect(302);
  });

  describe('per-destination token delivery', () => {
    // One deployment, two client kinds: a browser that needs a cookie session
    // and a native app that cannot see one, because the system browser it opens
    // for the flow keeps its cookies in a different sandbox from the app's own
    // HTTP client.
    const MIXED = ['https://app.example.com', { url: 'myapp://auth', delivery: 'fragment' as const }];

    const startAndCallback = async (
      agent: ReturnType<typeof request.agent>,
      returnTo: string,
      query: Record<string, string> = { code: 'code-1', state: 'state-1' },
    ): Promise<request.Response> => {
      await agent
        .get(`/sso/entra/start?returnTo=${encodeURIComponent(returnTo)}`)
        .set('accept', 'text/html')
        .expect(302);

      return agent.get('/sso/entra/callback').query(query).set('accept', 'text/html').expect(302);
    };

    it('should give a browser destination cookies and no tokens on the url', async () => {
      app = await buildApp('sso', true, { allowedReturnTo: MIXED });

      const response = await startAndCallback(request.agent(app.getHttpServer()), 'https://app.example.com/dash');
      const names = (response.headers['set-cookie'] as unknown as string[]).map(v => v.split('=')[0]);

      expect(names).toContain('access_token');
      expect(names).toContain('refresh_token');
      expect(response.headers.location).toBe('https://app.example.com/dash');
    });

    it('should give a native destination tokens in the fragment and no cookies', async () => {
      app = await buildApp('sso', true, { allowedReturnTo: MIXED });

      const response = await startAndCallback(request.agent(app.getHttpServer()), 'myapp://auth/cb');
      const location = new URL(response.headers.location as string);
      const fragment = new URLSearchParams(location.hash.slice(1));

      expect(fragment.get('accessToken')).toBe('access-token');
      expect(fragment.get('refreshToken')).toBe('refresh-token');
      // Nothing on the query, where a proxy log would record it.
      expect(location.search).toBe('');
      // No session cookie: the app's HTTP client could never read it, and it
      // would be left behind in the system browser for nobody.
      const written = ((response.headers['set-cookie'] as unknown as string[]) ?? []).map(v => v.split('=')[0]);

      expect(written).toEqual(['oidc_tx']);
    });

    it('should serve both destinations from the same running application', async () => {
      app = await buildApp('sso', true, { allowedReturnTo: MIXED });

      const web = await startAndCallback(request.agent(app.getHttpServer()), 'https://app.example.com/dash');
      const native = await startAndCallback(request.agent(app.getHttpServer()), 'myapp://auth/cb');

      expect((web.headers['set-cookie'] as unknown as string[]).some(c => c.startsWith('access_token='))).toBe(true);
      expect(new URL(native.headers.location as string).hash).toContain('accessToken=');
    });

    it('should redirect a native destination back with #error rather than an error page', async () => {
      app = await buildApp('sso', true, { allowedReturnTo: MIXED });

      const agent = request.agent(app.getHttpServer());

      // A native app only ever sees the system browser stop somewhere; an error
      // page gives it no signal to end its wait on.
      const response = await startAndCallback(agent, 'myapp://auth/cb', {
        state: 'state-1',
        error: 'access_denied',
        error_description: 'the user declined consent',
      });

      const fragment = new URLSearchParams(new URL(response.headers.location as string).hash.slice(1));

      expect(fragment.get('error')).toBe('access_denied');
      expect(fragment.get('error_description')).toBe('the user declined consent');
      expect(fragment.get('accessToken')).toBeNull();
    });

    it('should still answer a browser destination with a status code on failure', async () => {
      app = await buildApp('sso', true, { allowedReturnTo: MIXED });

      const agent = request.agent(app.getHttpServer());

      await agent
        .get('/sso/entra/start?returnTo=https%3A%2F%2Fapp.example.com%2Fdash')
        .set('accept', 'text/html')
        .expect(302);

      await agent
        .get('/sso/entra/callback')
        .query({ state: 'state-1', error: 'access_denied' })
        .set('accept', 'text/html')
        .expect(400);
    });

    it('should sanitise the issuer error text before putting it on a url', async () => {
      app = await buildApp('sso', true, { allowedReturnTo: MIXED });

      const response = await startAndCallback(request.agent(app.getHttpServer()), 'myapp://auth/cb', {
        state: 'state-1',
        error: 'access_denied',
        error_description: `bad"text\\here${'x'.repeat(500)}`,
      });

      const description = new URLSearchParams(new URL(response.headers.location as string).hash.slice(1)).get(
        'error_description',
      );

      // RFC 6749 §4.1.2.1 excludes " and \\, and an unbounded parameter has no
      // business in a Location header.
      expect(description).not.toContain('"');
      expect(description).not.toContain('\\');
      expect((description ?? '').length).toBeLessThanOrEqual(200);
    });

    it('should stay on the fragment even when cookieMode is off', async () => {
      // The two switches are independent: cookieMode decides what a `cookie`
      // destination gets, and says nothing about a destination that declared
      // its own delivery.
      app = await buildApp('sso', false, { allowedReturnTo: MIXED });

      const response = await startAndCallback(request.agent(app.getHttpServer()), 'myapp://auth/cb');
      const location = new URL(response.headers.location as string);

      expect(new URLSearchParams(location.hash.slice(1)).get('accessToken')).toBe('access-token');
      expect(location.search).toBe('');
    });

    it('should leave a cookie destination on the query string when cookieMode is off', async () => {
      // Unchanged behaviour for anyone who was already running this way.
      app = await buildApp('sso', false, { allowedReturnTo: MIXED });

      const response = await startAndCallback(request.agent(app.getHttpServer()), 'https://app.example.com/dash');
      const location = new URL(response.headers.location as string);

      expect(location.searchParams.get('accessToken')).toBe('access-token');
      expect(location.hash).toBe('');
    });

    it('should never fragment-deliver to the fallback', async () => {
      app = await buildApp('sso', true, { allowedReturnTo: MIXED });

      const response = await startAndCallback(request.agent(app.getHttpServer()), 'https://evil.example.com/steal');

      expect(response.headers.location).toBe('/home');
      expect(response.headers.location).not.toContain('#');
    });

    it('should preserve a fragment the destination already carried', async () => {
      app = await buildApp('sso', true, { allowedReturnTo: MIXED });

      const response = await startAndCallback(request.agent(app.getHttpServer()), 'myapp://auth/cb#existing');
      const hash = new URL(response.headers.location as string).hash;

      expect(hash.startsWith('#existing&')).toBe(true);
      expect(hash).toContain('accessToken=');
    });
  });
});
