import { createPublicKey, type JsonWebKey, type KeyObject } from 'node:crypto';
import { AuthProviderMisconfiguredError } from '../../constants/errors/base.error';

export interface OidcDiscoveryDocument {
  readonly issuer: string;
  readonly authorization_endpoint: string;
  readonly token_endpoint: string;
  readonly jwks_uri: string;
  readonly userinfo_endpoint?: string;
  readonly end_session_endpoint?: string;
}

interface JsonWebKeySet {
  readonly keys: readonly (JsonWebKey & { kid?: string; alg?: string; use?: string })[];
}

const isDiscoveryDocument = (value: unknown): value is OidcDiscoveryDocument => {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.issuer === 'string' &&
    typeof candidate.authorization_endpoint === 'string' &&
    typeof candidate.token_endpoint === 'string' &&
    typeof candidate.jwks_uri === 'string'
  );
};

/**
 * Fetches and caches an issuer's discovery document and signing keys.
 *
 * Both are cached for the lifetime of the provider instance; the key set is
 * refetched on a cache miss so an issuer rotating in a new `kid` is picked up
 * without a restart.
 */
export class OidcMetadataResolver {
  private discovery: Promise<OidcDiscoveryDocument> | null = null;
  private keys: Map<string, KeyObject> | null = null;

  constructor(private readonly issuer: string) {}

  async getDiscovery(): Promise<OidcDiscoveryDocument> {
    if (!this.discovery) {
      this.discovery = this.fetchDiscovery();
    }

    try {
      return await this.discovery;
    } catch (error) {
      // Never cache a failure: a transient outage would otherwise poison the
      // provider until the process restarts.
      this.discovery = null;

      throw error;
    }
  }

  async getSigningKey(kid: string | undefined): Promise<KeyObject> {
    const cached = kid ? this.keys?.get(kid) : this.singleCachedKey();

    if (cached) return cached;

    await this.refreshKeys();

    const resolved = kid ? this.keys?.get(kid) : this.singleCachedKey();

    if (!resolved) {
      throw new AuthProviderMisconfiguredError(
        kid ? `No signing key matching kid "${kid}" at the issuer` : 'Issuer exposes no usable signing key',
      );
    }

    return resolved;
  }

  private singleCachedKey(): KeyObject | undefined {
    // An id token without a kid is only unambiguous when the issuer publishes
    // exactly one key.
    return this.keys?.size === 1 ? [...this.keys.values()][0] : undefined;
  }

  private async fetchDiscovery(): Promise<OidcDiscoveryDocument> {
    const url = `${this.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new AuthProviderMisconfiguredError(`OIDC discovery failed with status ${response.status} for ${url}`);
    }

    const document: unknown = await response.json();

    if (!isDiscoveryDocument(document)) {
      throw new AuthProviderMisconfiguredError(`OIDC discovery document at ${url} is missing required fields`);
    }

    if (document.issuer !== this.issuer.replace(/\/$/, '')) {
      throw new AuthProviderMisconfiguredError(
        `OIDC discovery issuer mismatch: expected ${this.issuer}, document declares ${document.issuer}`,
      );
    }

    return document;
  }

  private async refreshKeys(): Promise<void> {
    const { jwks_uri: jwksUri } = await this.getDiscovery();
    const response = await fetch(jwksUri);

    if (!response.ok) {
      throw new AuthProviderMisconfiguredError(`Failed to fetch JWKS with status ${response.status} from ${jwksUri}`);
    }

    const keySet = (await response.json()) as JsonWebKeySet;
    const resolved = new Map<string, KeyObject>();

    keySet.keys
      ?.filter(key => key.use === undefined || key.use === 'sig')
      .forEach(key => {
        try {
          // Node can build a public key straight from a JWK, so verifying an id
          // token needs no extra dependency.
          resolved.set(key.kid ?? '', createPublicKey({ key, format: 'jwk' }));
        } catch {
          // A key we cannot parse (an unsupported curve, say) must not take the
          // whole set down with it.
        }
      });

    this.keys = resolved;
  }
}
