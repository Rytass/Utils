import { AuthProviderMisconfiguredError } from '../constants/errors/base.error';
import type { OidcAdapterConstructor } from './oidc-adapter';

export interface OidcGrant {
  addOIDCScope(scope: string): void;
  addOIDCClaims(claims: string[]): void;
  save(): Promise<string>;
}

export interface OidcInteractionDetails {
  uid: string;
  prompt: { name: string; details: Record<string, unknown>; reasons?: string[] };
  params: Record<string, unknown>;
  session?: { accountId?: string };
  grantId?: string;
}

export interface OidcAccount {
  accountId: string;
  claims(): Promise<Record<string, unknown>>;
}

export type FindAccountFn = (ctx: unknown, sub: string) => Promise<OidcAccount | undefined>;

export interface OidcProviderLike {
  proxy: boolean;
  callback(): (req: unknown, res: unknown) => void;
  interactionDetails(req: unknown, res: unknown): Promise<OidcInteractionDetails>;
  interactionFinished(req: unknown, res: unknown, result: Record<string, unknown>, options?: unknown): Promise<void>;
  Grant: new (props: { accountId: string; clientId: string }) => OidcGrant;
}

type ProviderConstructor = new (issuer: string, configuration: Record<string, unknown>) => OidcProviderLike;

/**
 * Load oidc-provider without letting a bundler rewrite the import.
 *
 * The package is ESM-only. Webpack resolves a literal `import()` and, for a
 * node target, turns it into `require()` — which throws on an ESM-only package.
 * Building the specifier through `new Function` keeps it opaque to static
 * analysis so the import survives to runtime as a real dynamic import.
 *
 * The cost is that the same opacity hides the dependency from Nx's
 * `generatePackageJson`, so it will not appear in a generated deployment
 * manifest. Applications must list oidc-provider in their own dependencies;
 * assertOidcProviderInstalled turns forgetting that into a clear boot-time
 * error rather than a puzzling runtime one.
 *
 * The function body is a constant with nothing interpolated into it, and the
 * specifier arrives as an argument rather than as concatenated source, so this
 * carries no injection surface.
 */
const importOidcProvider = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<{ default: ProviderConstructor }>;

export const assertOidcProviderInstalled = async (): Promise<void> => {
  try {
    await importOidcProvider('oidc-provider');
  } catch (error) {
    throw new AuthProviderMisconfiguredError(
      'oidc-provider is required by MemberBaseOidcProviderModule but could not be loaded. ' +
        'Add it to your application dependencies (npm install oidc-provider). ' +
        'Note that bundlers cannot see this dependency, so it will not appear in a generated package.json. ' +
        `Original error: ${(error as Error).message}`,
    );
  }
};

export interface CreateOidcProviderParams {
  issuer: string;
  adapter: OidcAdapterConstructor;
  findAccount: FindAccountFn;
  jwks: { keys: Record<string, unknown>[] };
  cookieKeys: string[];
  routePrefix: string;
  scopes: string[];
  claims: Record<string, string[]>;
  ttl: Record<string, number>;
  advanced?: Record<string, unknown>;
}

export const createOidcProvider = async (params: CreateOidcProviderParams): Promise<OidcProviderLike> => {
  const { default: Provider } = await importOidcProvider('oidc-provider');

  const provider = new Provider(params.issuer, {
    adapter: params.adapter,
    jwks: params.jwks,
    cookies: { keys: params.cookieKeys },
    findAccount: params.findAccount,
    scopes: params.scopes,
    claims: params.claims,
    ttl: params.ttl,
    features: {
      devInteractions: { enabled: false },
      rpInitiatedLogout: { enabled: true },
      revocation: { enabled: true },
      introspection: { enabled: true },
      userinfo: { enabled: true },
    },
    // Mandatory for public clients and harmless for confidential ones; without
    // it an intercepted authorization code is enough to obtain tokens.
    pkce: { required: (): boolean => true },
    interactions: {
      url(_ctx: unknown, interaction: { uid: string }): string {
        return `/${params.routePrefix}/interaction/${interaction.uid}`;
      },
    },
    clientBasedCORS(): boolean {
      return true;
    },
    ...params.advanced,
  });

  // The endpoint is nearly always behind a reverse proxy or ingress; without
  // this the provider derives request URLs from the internal hostname and the
  // issued redirects point somewhere unreachable.
  provider.proxy = true;

  return provider;
};
