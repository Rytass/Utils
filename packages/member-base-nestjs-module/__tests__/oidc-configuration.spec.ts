import { buildOidcConfiguration } from '../src/oidc/oidc.factory';
import type { CreateOidcProviderParams } from '../src/oidc/oidc.factory';
import type { OidcAdapterConstructor } from '../src/oidc/oidc-adapter';

const BASE: CreateOidcProviderParams = {
  issuer: 'https://idp.example.com/oidc',
  adapter: class {} as unknown as OidcAdapterConstructor,
  findAccount: async () => undefined,
  jwks: { keys: [] },
  cookieKeys: ['key'],
  routePrefix: 'oidc',
  scopes: ['openid'],
  claims: { openid: ['sub'] },
  ttl: { AccessToken: 3600 },
};

const build = (overrides: Partial<CreateOidcProviderParams> = {}): Record<string, unknown> =>
  buildOidcConfiguration({ ...BASE, ...overrides });

const featuresOf = (config: Record<string, unknown>): Record<string, { enabled: boolean }> =>
  config.features as Record<string, { enabled: boolean }>;

const pkceRequired = (config: Record<string, unknown>): boolean =>
  (config.pkce as { required: () => boolean }).required();

const corsAllowed = (config: Record<string, unknown>): boolean => (config.clientBasedCORS as () => boolean)();

describe('oidc configuration', () => {
  describe('defaults', () => {
    it('should enable the four protocol features and keep devInteractions off', () => {
      expect(featuresOf(build())).toEqual({
        devInteractions: { enabled: false },
        rpInitiatedLogout: { enabled: true },
        revocation: { enabled: true },
        introspection: { enabled: true },
        userinfo: { enabled: true },
      });
    });

    it('should require pkce and allow client-based cors', () => {
      expect(pkceRequired(build())).toBe(true);
      expect(corsAllowed(build())).toBe(true);
    });
  });

  describe('feature toggles', () => {
    it('should turn one feature off without disturbing the others', () => {
      const features = featuresOf(build({ features: { introspection: false } }));

      expect(features.introspection.enabled).toBe(false);
      expect(features.revocation.enabled).toBe(true);
      expect(features.userinfo.enabled).toBe(true);
      expect(features.rpInitiatedLogout.enabled).toBe(true);
    });

    it('should never enable devInteractions, which would shadow this module routes', () => {
      const features = featuresOf(build({ features: { devInteractions: true } as never }));

      expect(features.devInteractions.enabled).toBe(false);
    });
  });

  describe('opt-outs', () => {
    it('should allow pkce to be relaxed for a legacy client', () => {
      expect(pkceRequired(build({ requirePkce: false }))).toBe(false);
    });

    it('should allow client-based cors to be disabled', () => {
      expect(corsAllowed(build({ clientBasedCors: false }))).toBe(false);
    });
  });

  describe('advanced', () => {
    it('should still let advanced win, since it is the documented escape hatch', () => {
      const config = build({ features: { revocation: false }, advanced: { features: { revocation: true } } });

      // Whole-object replacement is exactly why the typed toggles exist; this
      // records that advanced keeps its last-word semantics regardless.
      expect(featuresOf(config)).toEqual({ revocation: true });
    });

    it('should leave everything else in place when advanced sets an unrelated key', () => {
      const config = build({ advanced: { rotateRefreshToken: false } });

      expect(config.rotateRefreshToken).toBe(false);
      expect(featuresOf(config).userinfo.enabled).toBe(true);
    });
  });

  it('should point interactions at the configured route prefix', () => {
    const config = build({ routePrefix: 'sso' });
    const interactions = config.interactions as { url: (ctx: unknown, i: { uid: string }) => string };

    expect(interactions.url(null, { uid: 'abc' })).toBe('/sso/interaction/abc');
  });
});
