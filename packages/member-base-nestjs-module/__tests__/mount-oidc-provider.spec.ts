import { ApplicationConfig } from '@nestjs/core';
import { mountMemberBaseOidcProvider } from '../src/oidc/mount-oidc-provider';
import { OIDC_PROVIDER_INSTANCE, OIDC_ROUTE_PREFIX } from '../src/oidc/oidc.tokens';

interface MountedRequest {
  url?: string;
}

type Middleware = (req: MountedRequest, res: unknown, next: () => void) => void;

interface Harness {
  readonly mountedWithPath: boolean;
  readonly middleware: Middleware;
  readonly handleProtocol: jest.Mock;
}

const mount = (options?: { routePrefix?: string; globalPrefix?: string }): Harness => {
  const handleProtocol = jest.fn();
  let mountedWithPath = false;
  let middleware: Middleware = () => undefined;

  const app = {
    get: (token: unknown): unknown => {
      if (token === OIDC_PROVIDER_INSTANCE) return { callback: (): jest.Mock => handleProtocol };

      if (token === OIDC_ROUTE_PREFIX) return options?.routePrefix ?? 'oidc';

      if (token === ApplicationConfig) {
        if (options?.globalPrefix === undefined) throw new Error('unexpected token');

        return { getGlobalPrefix: (): string => options.globalPrefix as string };
      }

      throw new Error('unexpected token');
    },
    use: (...handlers: unknown[]): void => {
      mountedWithPath = typeof handlers[0] === 'string';
      middleware = handlers[handlers.length - 1] as Middleware;
    },
  };

  mountMemberBaseOidcProvider(app as never);

  return { mountedWithPath, middleware, handleProtocol };
};

/** Runs one request through the middleware and reports what it did with it. */
const dispatch = (harness: Harness, url?: string): { url?: string; passedThrough: boolean } => {
  const req: MountedRequest = url === undefined ? {} : { url };
  const next = jest.fn();

  harness.middleware(req, {}, next);

  return { url: req.url, passedThrough: next.mock.calls.length > 0 };
};

describe('mountMemberBaseOidcProvider', () => {
  // Express strips a mount path for the handler and puts it back before the
  // request reaches the next layer. Registering with a path would therefore
  // hand Nest '/oidc/interaction/<uid>' while the controller sits on
  // '/interaction/<uid>', and every interactive login would 404.
  it('should register a single middleware with no mount path', () => {
    expect(mount().mountedWithPath).toBe(false);
  });

  it('should hand protocol endpoints to the provider without the prefix', () => {
    const harness = mount();

    ['/auth', '/token', '/me', '/jwks', '/.well-known/openid-configuration'].forEach(path => {
      const result = dispatch(harness, `/oidc${path}`);

      expect(result.passedThrough).toBe(false);
      // The provider derives its URLs from an issuer that already carries the
      // prefix, so it must see the path without it.
      expect(result.url).toBe(path);
    });

    expect(harness.handleProtocol).toHaveBeenCalledTimes(5);
  });

  it('should pass interaction requests through to nest with the prefix stripped', () => {
    const harness = mount();

    expect(dispatch(harness, '/oidc/interaction/abc123')).toEqual({
      url: '/interaction/abc123',
      passedThrough: true,
    });

    expect(dispatch(harness, '/oidc/interaction/abc123/login')).toEqual({
      url: '/interaction/abc123/login',
      passedThrough: true,
    });

    expect(harness.handleProtocol).not.toHaveBeenCalled();
  });

  it('should honour a custom route prefix', () => {
    const harness = mount({ routePrefix: 'identity' });

    expect(dispatch(harness, '/identity/interaction/abc')).toEqual({
      url: '/interaction/abc',
      passedThrough: true,
    });

    expect(dispatch(harness, '/identity/token').url).toBe('/token');
  });

  // Controller routes carry Nest's global prefix, but this middleware runs
  // ahead of Nest's router and sees the unmodified URL.
  it('should put a global prefix back on a passed-through interaction', () => {
    const harness = mount({ globalPrefix: 'api' });

    expect(dispatch(harness, '/oidc/interaction/abc')).toEqual({
      url: '/api/interaction/abc',
      passedThrough: true,
    });

    // The provider is mounted ahead of Nest, so its own paths gain nothing.
    expect(dispatch(harness, '/oidc/token').url).toBe('/token');
  });

  it('should tolerate an application that exposes no global prefix', () => {
    expect(dispatch(mount(), '/oidc/interaction/abc').url).toBe('/interaction/abc');
  });

  it('should still route a protocol endpoint whose name merely starts similarly', () => {
    const harness = mount();

    expect(dispatch(harness, '/oidc/introspection').url).toBe('/introspection');
    expect(harness.handleProtocol).toHaveBeenCalledTimes(1);
  });

  it('should serve the prefix itself and a bare query string', () => {
    const harness = mount();

    expect(dispatch(harness, '/oidc').url).toBe('/');
    expect(dispatch(harness, '/oidc?resource=x').url).toBe('/?resource=x');
    expect(harness.handleProtocol).toHaveBeenCalledTimes(2);
  });

  // '/oidcfoo' is somebody else's route and must be left completely alone.
  it('should ignore paths that only share the prefix as a substring', () => {
    const harness = mount();

    expect(dispatch(harness, '/oidcfoo')).toEqual({ url: '/oidcfoo', passedThrough: true });
    expect(dispatch(harness, '/health')).toEqual({ url: '/health', passedThrough: true });
    expect(harness.handleProtocol).not.toHaveBeenCalled();
  });

  it('should pass a request with no url through untouched', () => {
    const harness = mount();

    expect(dispatch(harness, undefined)).toEqual({ url: undefined, passedThrough: true });
    expect(harness.handleProtocol).not.toHaveBeenCalled();
  });
});
