import { Logger } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { RedirectAuthController, createRedirectAuthController } from '../src/controllers/redirect-auth.controller';
import { MemberBaseModule } from '../src/member-base.module';
import { OAuthCallbacksController } from '../src/controllers/oauth-callbacks.controller';
import {
  RedirectAuthDeniedError,
  RedirectAuthTransactionError,
  AuthProviderMisconfiguredError,
  AuthProviderNotFoundError,
} from '../src/constants/errors/base.error';
import { resolveRedirectAuthOptions } from '../src/typings/redirect-auth.options';
import type { AuthenticationGateway } from '../src/services/authentication-gateway.service';
import type { MemberBaseService } from '../src/services/member-base.service';
import type { AuthenticationProvider } from '../src/typings/authentication-provider.interface';
import type { ResolvedRedirectAuthOptions } from '../src/typings/redirect-auth.options';
import type { Request, Response } from 'express';

interface FakeResponse {
  cookies: { name: string; value: string; options: Record<string, unknown> }[];
  cleared: { name: string; options: Record<string, unknown> }[];
  redirectedTo: string | null;
  statusCode: number;
  body: unknown;
  cookie: jest.Mock;
  clearCookie: jest.Mock;
  redirect: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
}

const createResponse = (): FakeResponse => {
  const res: FakeResponse = {
    cookies: [],
    cleared: [],
    redirectedTo: null,
    statusCode: 200,
    body: undefined,
    cookie: jest.fn((name: string, value: string, options: Record<string, unknown>) => {
      res.cookies.push({ name, value, options });

      return res;
    }),
    clearCookie: jest.fn((name: string, options: Record<string, unknown>) => {
      res.cleared.push({ name, options });

      return res;
    }),
    redirect: jest.fn((url: string) => {
      res.redirectedTo = url;
    }),
    status: jest.fn((code: number) => {
      res.statusCode = code;

      return res;
    }),
    json: jest.fn((body: unknown) => {
      res.body = body;
    }),
  };

  return res;
};

const createRequest = (overrides?: {
  cookies?: Record<string, string>;
  cookieHeader?: string;
  accept?: string;
}): Request =>
  ({
    ip: '203.0.113.9',
    hostname: 'app.example.com',
    secure: true,
    cookies: overrides?.cookies,
    headers: {
      ...(overrides?.accept ? { accept: overrides.accept } : {}),
      ...(overrides?.cookieHeader ? { cookie: overrides.cookieHeader } : {}),
    },
  }) as unknown as Request;

const BROWSER = { accept: 'text/html,application/xhtml+xml' };

const redirectProvider = (): AuthenticationProvider & {
  createAuthorizationRequest: jest.Mock;
} =>
  ({
    channel: 'entra',
    kind: 'redirect',
    createAuthorizationRequest: jest.fn(async () => ({
      url: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?state=state-1',
      state: 'state-1',
      codeVerifier: 'verifier-1',
      nonce: 'nonce-1',
    })),
  }) as unknown as AuthenticationProvider & { createAuthorizationRequest: jest.Mock };

interface Harness {
  controller: RedirectAuthController;
  gateway: {
    getProvider: jest.Mock;
    handleCallback: jest.Mock;
    getAuthorizationUrl: jest.Mock;
    listProviders: jest.Mock;
  };
  provider: ReturnType<typeof redirectProvider>;
  options: ResolvedRedirectAuthOptions;
}

const buildController = (
  overrides?: Partial<Parameters<typeof resolveRedirectAuthOptions>[0]>,
  cookieMode = true,
): Harness => {
  const provider = redirectProvider();

  const gateway = {
    getProvider: jest.fn(() => provider),
    handleCallback: jest.fn(async () => ({ member: { id: 'member-1' }, identity: { channel: 'entra' } })),
    getAuthorizationUrl: jest.fn(async () => 'https://legacy.example.com/authorize'),
    listProviders: jest.fn(() => [provider]),
  };

  const memberBaseService = {
    signAccessToken: jest.fn(() => 'access-token'),
    signRefreshToken: jest.fn(() => 'refresh-token'),
  };

  const options = resolveRedirectAuthOptions(
    { allowedReturnTo: ['https://app.example.com', 'myapp://auth'], ...overrides },
    {
      accessTokenCookieName: 'access_token',
      refreshTokenCookieName: 'refresh_token',
      cookieOptions: { path: '/', sameSite: 'lax' },
      accessTokenExpiration: 900,
      refreshTokenExpiration: 7_776_000,
    },
  );

  const controller = new RedirectAuthController(
    options,
    gateway as unknown as AuthenticationGateway,
    memberBaseService as unknown as MemberBaseService,
    cookieMode,
  );

  return { controller, gateway, provider, options };
};

describe('RedirectAuthController start', () => {
  it('should redirect a browser to the issuer and store the transaction', async () => {
    const { controller, options } = buildController();
    const res = createResponse();

    await controller.start('entra', undefined, createRequest(BROWSER), res as unknown as Response);

    expect(res.redirectedTo).toContain('login.microsoftonline.com');

    const [cookie] = res.cookies;

    expect(cookie.name).toBe(options.txCookieName);
    expect(JSON.parse(cookie.value)).toEqual({
      channel: 'entra',
      state: 'state-1',
      codeVerifier: 'verifier-1',
      nonce: 'nonce-1',
      returnTo: '/',
    });

    expect(cookie.options).toMatchObject({ httpOnly: true, maxAge: 600_000, sameSite: 'lax' });
  });

  it('should answer an api client with the location as data', async () => {
    const { controller } = buildController();
    const res = createResponse();

    await controller.start('entra', undefined, createRequest({ accept: '*/*' }), res as unknown as Response);

    expect(res.redirectedTo).toBeNull();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ redirectTo: expect.stringContaining('login.microsoftonline.com') });
  });

  it('should store an allowed returnTo and drop one that is not listed', async () => {
    const { controller, options } = buildController();

    const allowed = createResponse();

    await controller.start(
      'entra',
      'https://app.example.com/reports',
      createRequest(BROWSER),
      allowed as unknown as Response,
    );

    expect(JSON.parse(allowed.cookies[0].value).returnTo).toBe('https://app.example.com/reports');

    const rejected = createResponse();

    await controller.start(
      'entra',
      'https://evil.example.com/steal',
      createRequest(BROWSER),
      rejected as unknown as Response,
    );

    expect(JSON.parse(rejected.cookies[0].value).returnTo).toBe(options.successRedirect);
  });

  it('should refuse a channel that is not a redirect provider', async () => {
    const { controller, gateway } = buildController();

    gateway.getProvider.mockReturnValue({ channel: 'password', kind: 'credential' });

    await expect(
      controller.start('password', undefined, createRequest(BROWSER), createResponse() as unknown as Response),
    ).rejects.toBeInstanceOf(AuthProviderMisconfiguredError);
  });

  it('should let an unknown channel raise the gateway error unchanged', async () => {
    const { controller, gateway } = buildController();

    gateway.getProvider.mockImplementation(() => {
      throw new AuthProviderNotFoundError('nope');
    });

    await expect(
      controller.start('nope', undefined, createRequest(BROWSER), createResponse() as unknown as Response),
    ).rejects.toBeInstanceOf(AuthProviderNotFoundError);
  });

  it('should generate its own state for a provider that predates createAuthorizationRequest', async () => {
    const { controller, gateway } = buildController();

    gateway.getProvider.mockReturnValue({ channel: 'legacy', kind: 'redirect' });

    const res = createResponse();

    await controller.start('legacy', undefined, createRequest(BROWSER), res as unknown as Response);

    const transaction = JSON.parse(res.cookies[0].value);

    expect(transaction.state).toEqual(expect.any(String));
    expect(transaction.codeVerifier).toBeUndefined();
    expect(gateway.getAuthorizationUrl).toHaveBeenCalledWith('legacy', transaction.state, { ip: '203.0.113.9' });
  });

  it('should relax a strict sameSite for the transaction cookie only', async () => {
    const { controller } = buildController({ cookieOptions: { sameSite: 'strict' } });
    const res = createResponse();

    await controller.start('entra', undefined, createRequest(BROWSER), res as unknown as Response);

    // A Strict cookie is not sent on the navigation back from the issuer, which
    // would make every callback fail with a missing transaction.
    expect(res.cookies[0].options.sameSite).toBe('lax');
  });
});

describe('RedirectAuthController callback', () => {
  const transactionCookie = (overrides?: Record<string, unknown>): Record<string, string> => ({
    oidc_tx: JSON.stringify({
      channel: 'entra',
      state: 'state-1',
      codeVerifier: 'verifier-1',
      nonce: 'nonce-1',
      returnTo: 'https://app.example.com/reports',
      ...overrides,
    }),
  });

  it('should complete the flow, write cookies and redirect', async () => {
    const { controller, gateway } = buildController();
    const res = createResponse();

    await controller.callback(
      'entra',
      'code-1',
      'state-1',
      undefined,
      undefined,
      createRequest({ ...BROWSER, cookies: transactionCookie() }),
      res as unknown as Response,
    );

    expect(gateway.handleCallback).toHaveBeenCalledWith(
      'entra',
      { code: 'code-1', codeVerifier: 'verifier-1', nonce: 'nonce-1' },
      { ip: '203.0.113.9' },
    );

    expect(res.cookies.map(cookie => cookie.name)).toEqual(['access_token', 'refresh_token']);
    expect(res.cookies[0].options).toMatchObject({ httpOnly: true, maxAge: 900_000 });
    expect(res.cookies[1].options).toMatchObject({ maxAge: 7_776_000_000 });
    expect(res.redirectedTo).toBe('https://app.example.com/reports');
  });

  it('should clear the transaction cookie with the attributes it was set with', async () => {
    const { controller } = buildController();
    const res = createResponse();

    await controller.callback(
      'entra',
      'code-1',
      'state-1',
      undefined,
      undefined,
      createRequest({ ...BROWSER, cookies: transactionCookie() }),
      res as unknown as Response,
    );

    expect(res.cleared).toEqual([{ name: 'oidc_tx', options: { path: '/', sameSite: 'lax', secure: true } }]);
  });

  it('should read the transaction from a raw cookie header when cookie-parser is absent', async () => {
    const { controller } = buildController();
    const res = createResponse();
    const raw = encodeURIComponent(transactionCookie().oidc_tx);

    await controller.callback(
      'entra',
      'code-1',
      'state-1',
      undefined,
      undefined,
      createRequest({ ...BROWSER, cookieHeader: `other=1; oidc_tx=${raw}` }),
      res as unknown as Response,
    );

    expect(res.redirectedTo).toBe('https://app.example.com/reports');
  });

  it('should reject a mismatched state', async () => {
    const { controller, gateway } = buildController();

    await expect(
      controller.callback(
        'entra',
        'code-1',
        'forged-state',
        undefined,
        undefined,
        createRequest({ ...BROWSER, cookies: transactionCookie() }),
        createResponse() as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(RedirectAuthTransactionError);

    expect(gateway.handleCallback).not.toHaveBeenCalled();
  });

  it('should reject a callback with no transaction cookie', async () => {
    const { controller } = buildController();

    await expect(
      controller.callback(
        'entra',
        'code-1',
        'state-1',
        undefined,
        undefined,
        createRequest(BROWSER),
        createResponse() as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(RedirectAuthTransactionError);
  });

  it('should reject a transaction that started on another channel', async () => {
    const { controller } = buildController();

    await expect(
      controller.callback(
        'entra',
        'code-1',
        'state-1',
        undefined,
        undefined,
        createRequest({ ...BROWSER, cookies: transactionCookie({ channel: 'other' }) }),
        createResponse() as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(RedirectAuthTransactionError);
  });

  it('should reject an unreadable transaction cookie', async () => {
    const { controller } = buildController();

    await expect(
      controller.callback(
        'entra',
        'code-1',
        'state-1',
        undefined,
        undefined,
        createRequest({ ...BROWSER, cookies: { oidc_tx: 'not json' } }),
        createResponse() as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(RedirectAuthTransactionError);
  });

  it('should surface the issuer refusing the request', async () => {
    const { controller } = buildController();

    await expect(
      controller.callback(
        'entra',
        undefined,
        'state-1',
        'access_denied',
        'the user declined consent',
        createRequest({ ...BROWSER, cookies: transactionCookie() }),
        createResponse() as unknown as Response,
      ),
    ).rejects.toMatchObject({ oauthError: 'access_denied' });
  });

  it('should validate the state before trusting the issuer error', async () => {
    const { controller } = buildController();

    // oauthError is exposed so a host can branch on it. Reading it before the
    // state check would let it carry arbitrary text from anyone presenting some
    // readable transaction cookie.
    await expect(
      controller.callback(
        'entra',
        undefined,
        'forged-state',
        'access_denied',
        undefined,
        createRequest({ ...BROWSER, cookies: transactionCookie() }),
        createResponse() as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(RedirectAuthTransactionError);
  });

  it('should still report a denial that arrived with a matching state', async () => {
    const { controller } = buildController();

    // RFC 6749 requires the issuer to echo state on the error response, so the
    // legitimate denial path is unaffected by the ordering.
    await expect(
      controller.callback(
        'entra',
        undefined,
        'state-1',
        'access_denied',
        'the user declined consent',
        createRequest({ ...BROWSER, cookies: transactionCookie() }),
        createResponse() as unknown as Response,
      ),
    ).rejects.toMatchObject({ oauthError: 'access_denied', oauthErrorDescription: 'the user declined consent' });
  });

  it('should clear the transaction even when the callback fails', async () => {
    const { controller } = buildController();
    const res = createResponse();

    await expect(
      controller.callback(
        'entra',
        undefined,
        'state-1',
        'access_denied',
        undefined,
        createRequest({ ...BROWSER, cookies: transactionCookie() }),
        res as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(RedirectAuthDeniedError);

    // A failed attempt must not leave a reusable state behind.
    expect(res.cleared).toHaveLength(1);
  });

  it('should re-check the stored returnTo on the way out', async () => {
    const { controller, options } = buildController();
    const res = createResponse();

    await controller.callback(
      'entra',
      'code-1',
      'state-1',
      undefined,
      undefined,
      createRequest({ ...BROWSER, cookies: transactionCookie({ returnTo: 'https://evil.example.com/steal' }) }),
      res as unknown as Response,
    );

    expect(res.redirectedTo).toBe(options.successRedirect);
  });

  it('should answer an api client with the destination as data', async () => {
    const { controller } = buildController();
    const res = createResponse();

    await controller.callback(
      'entra',
      'code-1',
      'state-1',
      undefined,
      undefined,
      createRequest({ accept: '*/*', cookies: transactionCookie() }),
      res as unknown as Response,
    );

    expect(res.redirectedTo).toBeNull();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ redirectTo: 'https://app.example.com/reports' });
  });

  it('should carry the tokens on the destination when cookieMode is off', async () => {
    const { controller } = buildController(undefined, false);
    const res = createResponse();

    await controller.callback(
      'entra',
      'code-1',
      'state-1',
      undefined,
      undefined,
      createRequest({ ...BROWSER, cookies: transactionCookie() }),
      res as unknown as Response,
    );

    // Same convention OAuthCallbacksController has always used: with cookieMode
    // off, a cookie this route wrote would never be read back.
    expect(res.cookies.map(cookie => cookie.name)).toEqual([]);
    expect(res.redirectedTo).toBe(
      'https://app.example.com/reports?accessToken=access-token&refreshToken=refresh-token',
    );
  });

  it('should answer 400, not 500, on a malformed cookie escape', async () => {
    const { controller } = buildController();

    // decodeURIComponent throws URIError on a bad escape, and the Cookie header
    // is entirely attacker-controlled: `Cookie: oidc_tx=%` used to escape the
    // handler as an unauthenticated 500.
    await expect(
      controller.callback(
        'entra',
        'code-1',
        'state-1',
        undefined,
        undefined,
        createRequest({ ...BROWSER, cookieHeader: 'oidc_tx=%' }),
        createResponse() as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(RedirectAuthTransactionError);
  });

  it('should put the tokens in the query when the destination carries a fragment', async () => {
    const { controller } = buildController(
      { allowedReturnTo: ['https://app.example.com'], successRedirect: '/' },
      false,
    );

    const res = createResponse();

    await controller.callback(
      'entra',
      'code-1',
      'state-1',
      undefined,
      undefined,
      createRequest({
        ...BROWSER,
        cookies: transactionCookie({ returnTo: 'https://app.example.com/dash#section' }),
      }),
      res as unknown as Response,
    );

    // Appending after a fragment buries the tokens in the hash, where they never
    // reach the destination server and the login silently completes for nobody.
    const destination = new URL(res.redirectedTo ?? '');

    expect(destination.searchParams.get('accessToken')).toBe('access-token');
    expect(destination.searchParams.get('refreshToken')).toBe('refresh-token');
    expect(destination.hash).toBe('#section');
  });

  it('should keep an existing query string when adding the tokens', async () => {
    const { controller } = buildController(
      { allowedReturnTo: ['https://app.example.com'], successRedirect: '/' },
      false,
    );

    const res = createResponse();

    await controller.callback(
      'entra',
      'code-1',
      'state-1',
      undefined,
      undefined,
      createRequest({
        ...BROWSER,
        cookies: transactionCookie({ returnTo: 'https://app.example.com/dash?a=1#s' }),
      }),
      res as unknown as Response,
    );

    const destination = new URL(res.redirectedTo ?? '');

    expect(destination.searchParams.get('a')).toBe('1');
    expect(destination.searchParams.get('accessToken')).toBe('access-token');
    expect(destination.hash).toBe('#s');
  });

  it('should honour overridden cookie names', async () => {
    const { controller } = buildController({
      accessTokenCookieName: 'app_at',
      refreshTokenCookieName: 'app_rt',
      txCookieName: 'app_tx',
    });

    const res = createResponse();

    await controller.callback(
      'entra',
      'code-1',
      'state-1',
      undefined,
      undefined,
      createRequest({
        ...BROWSER,
        cookies: { app_tx: transactionCookie().oidc_tx },
      }),
      res as unknown as Response,
    );

    expect(res.cookies.map(cookie => cookie.name)).toEqual(['app_at', 'app_rt']);
    expect(res.cleared[0].name).toBe('app_tx');
  });
});

describe('redirect auth route registration', () => {
  it('should not register the routes unless redirectAuth is configured', () => {
    const { controllers } = MemberBaseModule.forRoot({});

    expect(controllers).toEqual([OAuthCallbacksController]);
  });

  it('should register them at the default prefix once configured', () => {
    const { controllers } = MemberBaseModule.forRoot({ redirectAuth: {} });

    expect(controllers).toHaveLength(2);
    expect(Reflect.getMetadata(PATH_METADATA, (controllers ?? [])[1] as object)).toBe('auth');
  });

  it('should register them at a configured prefix', () => {
    const { controllers } = MemberBaseModule.forRoot({ redirectAuth: { routePrefix: 'sso' } });

    expect(Reflect.getMetadata(PATH_METADATA, (controllers ?? [])[1] as object)).toBe('sso');
  });

  it('should leave the existing OAuth2 callbacks controller in place', () => {
    const { controllers } = MemberBaseModule.forRoot({ redirectAuth: { routePrefix: 'sso' } });

    expect((controllers ?? [])[0]).toBe(OAuthCallbacksController);
  });

  it('should mount from forRootAsync, where the factory has not run yet', () => {
    const mounted = MemberBaseModule.forRootAsync({ useFactory: () => ({}), redirectAuth: { routePrefix: 'sso' } });
    const unmounted = MemberBaseModule.forRootAsync({ useFactory: () => ({}) });

    expect(Reflect.getMetadata(PATH_METADATA, (mounted.controllers ?? [])[1] as object)).toBe('sso');
    expect(unmounted.controllers).toEqual([OAuthCallbacksController]);
  });

  it('should accept the boolean shorthand on forRootAsync', () => {
    const { controllers } = MemberBaseModule.forRootAsync({ useFactory: () => ({}), redirectAuth: true });

    expect(Reflect.getMetadata(PATH_METADATA, (controllers ?? [])[1] as object)).toBe('auth');
  });

  it.each(['', '/', '///', ' ', ' / ', '\t', '.', '..', '/./'])(
    'should refuse routePrefix %j rather than mounting at the app root',
    prefix => {
      // Two greedy two-segment routes at the root would swallow other paths and
      // work well enough for nobody to notice.
      expect(() => MemberBaseModule.forRoot({ redirectAuth: { routePrefix: prefix } })).toThrow(
        /is not a usable path segment/,
      );
    },
  );

  it('should trim surrounding slashes from a usable prefix', () => {
    const { controllers } = MemberBaseModule.forRoot({ redirectAuth: { routePrefix: '/sso/' } });

    expect(Reflect.getMetadata(PATH_METADATA, (controllers ?? [])[1] as object)).toBe('sso');
  });

  it('should report no prefix at all when the routes are not mounted', () => {
    // `string` can only answer with a path that 404s; the honest answer is null.
    const resolved = resolveRedirectAuthOptions(
      { routePrefix: 'sso' },
      {
        mountedPrefix: null,
        accessTokenCookieName: 'access_token',
        refreshTokenCookieName: 'refresh_token',
        cookieOptions: { path: '/', sameSite: 'lax' },
        accessTokenExpiration: 900,
        refreshTokenExpiration: 7_776_000,
      },
    );

    expect(resolved.routePrefix).toBeNull();
  });

  it('should report the mounted prefix, not the configured one', () => {
    // Under forRootAsync the factory's routePrefix cannot take effect, so a
    // consumer injecting REDIRECT_AUTH_OPTIONS to build a login link must be
    // told where the routes actually are.
    const resolved = resolveRedirectAuthOptions(
      { routePrefix: 'sso' },
      {
        mountedPrefix: 'auth',
        accessTokenCookieName: 'access_token',
        refreshTokenCookieName: 'refresh_token',
        cookieOptions: { path: '/', sameSite: 'lax' },
        accessTokenExpiration: 900,
        refreshTokenExpiration: 7_776_000,
      },
    );

    expect(resolved.routePrefix).toBe('auth');
  });

  it('should warn when a redirect channel is shadowed by the legacy oauth routes', () => {
    const { controller, gateway } = buildController();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    gateway.listProviders = jest.fn(() => [
      { channel: 'login', kind: 'redirect' },
      { channel: 'entra', kind: 'redirect' },
    ]) as unknown as typeof gateway.listProviders;

    controller.onApplicationBootstrap();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('login'));

    warn.mockRestore();
  });

  it('should stay silent when no channel is shadowed', () => {
    const { controller, gateway } = buildController();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    gateway.listProviders = jest.fn(() => [
      { channel: 'entra', kind: 'redirect' },
    ]) as unknown as typeof gateway.listProviders;

    controller.onApplicationBootstrap();

    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('should inherit the handlers and dependencies from the base controller', () => {
    const Mounted = createRedirectAuthController('auth');

    expect(Object.getPrototypeOf(Mounted)).toBe(RedirectAuthController);
    // Nest walks the prototype chain for both, which is what lets the path be
    // applied without duplicating the implementation.
    expect(typeof Mounted.prototype.start).toBe('function');
    expect(typeof Mounted.prototype.callback).toBe('function');
    expect(Reflect.getMetadata('self:paramtypes', Mounted)).toHaveLength(4);
  });
});
