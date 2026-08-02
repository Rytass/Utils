import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OidcMetadataResolver } from './oidc-discovery';
import { AuthProviderMisconfiguredError, InvalidToken } from '../../constants/errors/base.error';
import type {
  AuthContext,
  AuthenticatedIdentity,
  AuthenticationProvider,
  AuthorizationRequest,
  AuthProviderKind,
} from '../../typings/authentication-provider.interface';

export interface OidcAuthProviderOptions {
  /** Channel name this provider registers under. */
  channel: string;
  /** Issuer identifier; discovery is performed against `${issuer}/.well-known/openid-configuration`. */
  issuer: string;

  /**
   * Base URL to use for back-channel calls (discovery, token, JWKS, userinfo)
   * in place of the issuer's public origin.
   *
   * The issuer identifier is a stable public name that also appears in the id
   * token, so it cannot be swapped for an internal address without breaking
   * verification. But when the provider runs next to the issuer — a sidecar
   * container, a service on the same cluster — routing server-to-server calls
   * through the public hostname means leaving and re-entering the network for
   * no reason, and often does not resolve at all.
   *
   * Endpoints are rewritten by replacing the issuer prefix, so
   * `https://idp.example.com/oidc/token` becomes
   * `http://localhost:4530/oidc/token`. The user-facing authorization URL is
   * never rewritten: the browser has to reach the public address.
   */
  internalBaseUrl?: string;

  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  /** default: ['openid', 'profile', 'email'] */
  scope?: string[];
  /** default: true. RFC 7636 is mandatory for public clients and harmless otherwise. */
  usePKCE?: boolean;
  /**
   * Claim used as the stable identifier for the local binding.
   * default: 'sub' — the only claim an issuer guarantees is stable.
   */
  identifierClaim?: string;
  /**
   * Fetch the userinfo endpoint and merge its claims into the identity.
   * default: false — the id token usually carries everything needed.
   */
  fetchUserinfo?: boolean;
  /** Extra authorization request parameters (prompt, login_hint, acr_values...). */
  extraAuthorizationParams?: Record<string, string>;
}

interface TokenResponse {
  readonly access_token: string;
  readonly id_token?: string;
  readonly refresh_token?: string;
}

interface IdTokenClaims {
  readonly sub: string;
  readonly aud: string | string[];
  readonly iss: string;
  readonly nonce?: string;
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly [claim: string]: unknown;
}

const base64url = (input: Buffer): string => input.toString('base64url');

const decodeProtectedHeader = (token: string): { kid?: string; alg?: string } => {
  const [encodedHeader] = token.split('.');

  if (!encodedHeader) {
    throw new InvalidToken();
  }

  try {
    return JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as { kid?: string; alg?: string };
  } catch {
    throw new InvalidToken();
  }
};

/**
 * Authenticates against any standards-compliant OIDC issuer.
 *
 * Unlike the bundled OAuth2 flows this performs discovery, uses PKCE, and
 * actually verifies the id token signature, issuer, audience and nonce before
 * trusting a single claim.
 *
 * The provider is stateless: the PKCE verifier and nonce are handed back to the
 * caller in the authorization request and must be returned through
 * handleCallback, so the application can run more than one instance.
 */
export class OidcAuthProvider implements AuthenticationProvider {
  readonly channel: string;
  readonly kind: AuthProviderKind = 'redirect';

  private readonly metadata: OidcMetadataResolver;

  constructor(private readonly options: OidcAuthProviderOptions) {
    this.channel = options.channel;
    this.metadata = new OidcMetadataResolver(options.issuer, options.internalBaseUrl);
  }

  async createAuthorizationRequest(_context?: AuthContext): Promise<AuthorizationRequest> {
    const { authorization_endpoint: authorizationEndpoint } = await this.metadata.getDiscovery();

    const state = base64url(randomBytes(16));
    const nonce = base64url(randomBytes(16));
    const usePKCE = this.options.usePKCE ?? true;
    const codeVerifier = usePKCE ? base64url(randomBytes(32)) : undefined;

    const params = new URLSearchParams({
      client_id: this.options.clientId,
      response_type: 'code',
      redirect_uri: this.options.redirectUri,
      scope: (this.options.scope ?? ['openid', 'profile', 'email']).join(' '),
      state,
      nonce,
      ...this.options.extraAuthorizationParams,
    });

    if (codeVerifier) {
      params.set('code_challenge', base64url(createHash('sha256').update(codeVerifier).digest()));
      params.set('code_challenge_method', 'S256');
    }

    return {
      url: `${authorizationEndpoint}?${params.toString()}`,
      state,
      nonce,
      codeVerifier,
    };
  }

  async getAuthorizationUrl(): Promise<string> {
    // PKCE and nonce demand that the caller retain per-attempt secrets, which a
    // bare url cannot express.
    throw new AuthProviderMisconfiguredError(
      `Provider "${this.channel}" requires createAuthorizationRequest so the PKCE verifier and nonce can be retained`,
    );
  }

  /**
   * Complete the callback.
   *
   * Expects `code`, plus the `codeVerifier` and `nonce` the caller stored when
   * the authorization request was created. State validation belongs to the
   * caller, which is the side that persisted it.
   */
  async handleCallback(params: Record<string, string>): Promise<AuthenticatedIdentity> {
    const { code, codeVerifier, nonce } = params;

    if (!code) {
      throw new InvalidToken();
    }

    const tokens = await this.exchangeCode(code, codeVerifier);

    if (!tokens.id_token) {
      throw new AuthProviderMisconfiguredError(`Issuer for "${this.channel}" returned no id token`);
    }

    const claims = await this.verifyIdToken(tokens.id_token, nonce);
    const attributes = this.options.fetchUserinfo
      ? { ...claims, ...(await this.fetchUserinfo(tokens.access_token)) }
      : claims;

    const identifierClaim = this.options.identifierClaim ?? 'sub';
    const identifier = attributes[identifierClaim];

    if (typeof identifier !== 'string' || identifier === '') {
      throw new AuthProviderMisconfiguredError(
        `Claim "${identifierClaim}" is missing from the identity returned by "${this.channel}"`,
      );
    }

    return {
      channel: this.channel,
      identifier,
      // Only meaningful when the identifier is an email; for a sub-based
      // identifier the issuer is authoritative by definition.
      identifierVerified: identifierClaim === 'sub' ? true : attributes.email_verified === true,
      attributes,
    };
  }

  private async exchangeCode(code: string, codeVerifier?: string): Promise<TokenResponse> {
    const { token_endpoint: tokenEndpoint } = await this.metadata.getDiscovery();

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.options.redirectUri,
      client_id: this.options.clientId,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });

    const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };

    if (this.options.clientSecret) {
      const credentials = `${this.options.clientId}:${this.options.clientSecret}`;

      headers.authorization = `Basic ${Buffer.from(credentials).toString('base64')}`;
    }

    const response = await fetch(this.metadata.toInternalUrl(tokenEndpoint), {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      throw new InvalidToken();
    }

    return (await response.json()) as TokenResponse;
  }

  private async verifyIdToken(idToken: string, expectedNonce?: string): Promise<IdTokenClaims> {
    const { kid } = decodeProtectedHeader(idToken);
    const key = await this.metadata.getSigningKey(kid);
    const { issuer } = await this.metadata.getDiscovery();

    let claims: IdTokenClaims;

    try {
      claims = jwt.verify(idToken, key, {
        issuer,
        audience: this.options.clientId,
        // Pinned to asymmetric algorithms: accepting the token's own alg would
        // let an issuer (or an attacker who can reach this endpoint) downgrade
        // to HMAC and have the public key treated as a shared secret.
        algorithms: ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512'],
      }) as IdTokenClaims;
    } catch {
      throw new InvalidToken();
    }

    // A nonce is only enforced when the caller retained one; an issuer echoing
    // a different value means the response was replayed from another session.
    if (expectedNonce !== undefined && claims.nonce !== expectedNonce) {
      throw new InvalidToken();
    }

    return claims;
  }

  private async fetchUserinfo(accessToken: string): Promise<Record<string, unknown>> {
    const { userinfo_endpoint: userinfoEndpoint } = await this.metadata.getDiscovery();

    if (!userinfoEndpoint) return {};

    const response = await fetch(this.metadata.toInternalUrl(userinfoEndpoint), {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new InvalidToken();
    }

    return (await response.json()) as Record<string, unknown>;
  }
}
