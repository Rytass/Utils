import { mountMemberBaseOidcProvider } from '../src/oidc/mount-oidc-provider';
import { OIDC_PROVIDER_INSTANCE, OIDC_ROUTE_PREFIX } from '../src/oidc/oidc.tokens';

type Middleware = (req: { url?: string }, res: unknown, next: () => void) => void;

interface Harness {
  readonly mountedPath: string;
  readonly middleware: Middleware;
  readonly handleProtocol: jest.Mock;
}

const mount = (routePrefix = 'oidc'): Harness => {
  const handleProtocol = jest.fn();
  let mountedPath = '';
  let middleware: Middleware = () => undefined;

  const app = {
    get: (token: unknown): unknown => {
      if (token === OIDC_PROVIDER_INSTANCE) return { callback: (): jest.Mock => handleProtocol };

      if (token === OIDC_ROUTE_PREFIX) return routePrefix;

      throw new Error('unexpected token');
    },
    use: (path: string, handler: Middleware): void => {
      mountedPath = path;
      middleware = handler;
    },
  };

  mountMemberBaseOidcProvider(app as never);

  return { mountedPath, middleware, handleProtocol };
};

describe('mountMemberBaseOidcProvider', () => {
  it('should mount on the configured route prefix', () => {
    expect(mount().mountedPath).toBe('/oidc');
    expect(mount('identity').mountedPath).toBe('/identity');
  });

  it('should hand protocol endpoints to the provider', () => {
    const { middleware, handleProtocol } = mount();
    const next = jest.fn();

    ['/auth', '/token', '/me', '/jwks', '/.well-known/openid-configuration'].forEach(url => {
      middleware({ url }, {}, next);
    });

    expect(handleProtocol).toHaveBeenCalledTimes(5);
    expect(next).not.toHaveBeenCalled();
  });

  // The interaction pages are Nest controllers. Letting the provider answer
  // them 404s the screens the authorization flow redirects users to, which
  // breaks every interactive login.
  it('should pass interaction requests through to nest', () => {
    const { middleware, handleProtocol } = mount();
    const next = jest.fn();

    middleware({ url: '/interaction/abc123' }, {}, next);
    middleware({ url: '/interaction/abc123/login' }, {}, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(handleProtocol).not.toHaveBeenCalled();
  });

  it('should still route a protocol endpoint whose name merely starts similarly', () => {
    const { middleware, handleProtocol } = mount();
    const next = jest.fn();

    middleware({ url: '/introspection' }, {}, next);

    expect(handleProtocol).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('should hand a request with no url to the provider', () => {
    const { middleware, handleProtocol } = mount();
    const next = jest.fn();

    middleware({}, {}, next);

    expect(handleProtocol).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });
});
