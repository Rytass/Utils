import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import { OidcAuthProvider } from '../src/providers/oidc/oidc-auth.provider';
import { AuthProviderMisconfiguredError, InvalidToken } from '../src/constants/errors/base.error';

const ISSUER = 'https://idp.example.com/oidc';
const CLIENT_ID = 'sp-client';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-key';

const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' };

const DISCOVERY = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/auth`,
  token_endpoint: `${ISSUER}/token`,
  jwks_uri: `${ISSUER}/jwks`,
  userinfo_endpoint: `${ISSUER}/me`,
};

interface FetchStub {
  readonly calls: { url: string; init?: RequestInit }[];
  tokenResponse: unknown;
  tokenOk: boolean;
  userinfoResponse: unknown;
  discoveryOverride?: unknown;
  discoveryOk: boolean;
}

let stub: FetchStub;

const jsonResponse = (body: unknown, ok = true): Response =>
  ({
    ok,
    status: ok ? 200 : 500,
    json: async (): Promise<unknown> => body,
  }) as Response;

beforeEach(() => {
  stub = {
    calls: [],
    tokenResponse: {},
    tokenOk: true,
    userinfoResponse: {},
    discoveryOk: true,
  };

  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    stub.calls.push({ url, init });

    if (url.includes('.well-known')) {
      return jsonResponse(stub.discoveryOverride ?? DISCOVERY, stub.discoveryOk);
    }

    if (url.endsWith('/jwks')) return jsonResponse({ keys: [jwk] });

    if (url.endsWith('/token')) return jsonResponse(stub.tokenResponse, stub.tokenOk);

    if (url.endsWith('/me')) return jsonResponse(stub.userinfoResponse);

    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
});

const buildProvider = (overrides?: Partial<ConstructorParameters<typeof OidcAuthProvider>[0]>): OidcAuthProvider =>
  new OidcAuthProvider({
    channel: 'corp-idp',
    issuer: ISSUER,
    clientId: CLIENT_ID,
    clientSecret: 'sp-secret',
    redirectUri: 'https://app.example.com/auth/callback',
    ...overrides,
  });

const issueIdToken = (claims: Record<string, unknown>, options?: { kid?: string | null }): string =>
  sign({ iss: ISSUER, aud: CLIENT_ID, sub: 'subject-1', ...claims }, privateKey, {
    algorithm: 'RS256',
    expiresIn: 300,
    ...(options?.kid === null ? {} : { keyid: options?.kid ?? KID }),
  });

describe('OidcAuthProvider authorization request', () => {
  it('should build an authorization url with PKCE and a nonce', async () => {
    const request = await buildProvider().createAuthorizationRequest();
    const url = new URL(request.url);

    expect(url.origin + url.pathname).toBe(`${ISSUER}/auth`);
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toEqual(expect.any(String));
    expect(url.searchParams.get('state')).toBe(request.state);
    expect(url.searchParams.get('nonce')).toBe(request.nonce);
    expect(request.codeVerifier).toEqual(expect.any(String));
  });

  it('should omit PKCE when explicitly disabled', async () => {
    const request = await buildProvider({ usePKCE: false }).createAuthorizationRequest();

    expect(new URL(request.url).searchParams.has('code_challenge')).toBe(false);
    expect(request.codeVerifier).toBeUndefined();
  });

  it('should merge extra authorization params', async () => {
    const request = await buildProvider({
      extraAuthorizationParams: { prompt: 'login', acr_values: 'mfa' },
    }).createAuthorizationRequest();

    const url = new URL(request.url);

    expect(url.searchParams.get('prompt')).toBe('login');
    expect(url.searchParams.get('acr_values')).toBe('mfa');
  });

  it('should refuse the bare url helper because per-attempt secrets would be lost', async () => {
    await expect(buildProvider().getAuthorizationUrl()).rejects.toBeInstanceOf(AuthProviderMisconfiguredError);
  });

  it('should reject a discovery document whose issuer does not match', async () => {
    stub.discoveryOverride = { ...DISCOVERY, issuer: 'https://evil.example.com' };

    await expect(buildProvider().createAuthorizationRequest()).rejects.toBeInstanceOf(AuthProviderMisconfiguredError);
  });

  it('should not cache a failed discovery attempt', async () => {
    stub.discoveryOk = false;

    const provider = buildProvider();

    await expect(provider.createAuthorizationRequest()).rejects.toBeInstanceOf(AuthProviderMisconfiguredError);

    stub.discoveryOk = true;

    await expect(provider.createAuthorizationRequest()).resolves.toMatchObject({ url: expect.any(String) });
  });
});

describe('OidcAuthProvider callback', () => {
  it('should verify the id token and return the sub as identifier', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({ nonce: 'n-1', email: 'a@example.com' }) };

    const identity = await buildProvider().handleCallback({ code: 'c', codeVerifier: 'v', nonce: 'n-1' });

    expect(identity.channel).toBe('corp-idp');
    expect(identity.identifier).toBe('subject-1');
    expect(identity.identifierVerified).toBe(true);
    expect(identity.attributes?.email).toBe('a@example.com');
  });

  it('should send the PKCE verifier on the token request', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({ nonce: 'n-1' }) };

    await buildProvider().handleCallback({ code: 'c', codeVerifier: 'verifier-value', nonce: 'n-1' });

    const tokenCall = stub.calls.find(call => call.url.endsWith('/token'));

    expect(String(tokenCall?.init?.body)).toContain('code_verifier=verifier-value');
  });

  it('should reject a replayed response whose nonce does not match', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({ nonce: 'attacker-nonce' }) };

    await expect(
      buildProvider().handleCallback({ code: 'c', codeVerifier: 'v', nonce: 'expected-nonce' }),
    ).rejects.toBeInstanceOf(InvalidToken);
  });

  it('should reject an id token signed for a different audience', async () => {
    stub.tokenResponse = {
      access_token: 'at',
      id_token: sign({ iss: ISSUER, aud: 'someone-else', sub: 's' }, privateKey, {
        algorithm: 'RS256',
        expiresIn: 300,
        keyid: KID,
      }),
    };

    await expect(buildProvider().handleCallback({ code: 'c' })).rejects.toBeInstanceOf(InvalidToken);
  });

  it('should reject an id token signed by an unknown key', async () => {
    const { privateKey: rogueKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

    stub.tokenResponse = {
      access_token: 'at',
      id_token: sign({ iss: ISSUER, aud: CLIENT_ID, sub: 's' }, rogueKey, {
        algorithm: 'RS256',
        expiresIn: 300,
        keyid: KID,
      }),
    };

    await expect(buildProvider().handleCallback({ code: 'c' })).rejects.toBeInstanceOf(InvalidToken);
  });

  it('should reject a kid that the issuer does not publish', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({}, { kid: 'unknown-kid' }) };

    await expect(buildProvider().handleCallback({ code: 'c' })).rejects.toBeInstanceOf(AuthProviderMisconfiguredError);
  });

  // An HMAC-signed token whose "secret" is the issuer's public key must never
  // verify; algorithms are pinned to asymmetric families for exactly this.
  it('should reject an algorithm downgrade to HMAC', async () => {
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

    stub.tokenResponse = {
      access_token: 'at',
      id_token: sign({ iss: ISSUER, aud: CLIENT_ID, sub: 's' }, publicKeyPem, {
        algorithm: 'HS256',
        expiresIn: 300,
        keyid: KID,
      }),
    };

    await expect(buildProvider().handleCallback({ code: 'c' })).rejects.toBeInstanceOf(InvalidToken);
  });

  it('should reject an expired id token', async () => {
    stub.tokenResponse = {
      access_token: 'at',
      id_token: sign({ iss: ISSUER, aud: CLIENT_ID, sub: 's' }, privateKey, {
        algorithm: 'RS256',
        expiresIn: -10,
        keyid: KID,
      }),
    };

    await expect(buildProvider().handleCallback({ code: 'c' })).rejects.toBeInstanceOf(InvalidToken);
  });

  it('should reject a failed token exchange', async () => {
    stub.tokenOk = false;

    await expect(buildProvider().handleCallback({ code: 'c' })).rejects.toBeInstanceOf(InvalidToken);
  });

  it('should reject a response without an id token', async () => {
    stub.tokenResponse = { access_token: 'at' };

    await expect(buildProvider().handleCallback({ code: 'c' })).rejects.toBeInstanceOf(AuthProviderMisconfiguredError);
  });

  it('should reject a callback without a code', async () => {
    await expect(buildProvider().handleCallback({})).rejects.toBeInstanceOf(InvalidToken);
  });

  it('should merge userinfo claims when enabled', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({}) };
    stub.userinfoResponse = { sub: 'subject-1', department: 'finance' };

    const identity = await buildProvider({ fetchUserinfo: true }).handleCallback({ code: 'c' });

    expect(identity.attributes?.department).toBe('finance');
  });

  it('should support a non-sub identifier claim and defer to email_verified', async () => {
    stub.tokenResponse = {
      access_token: 'at',
      id_token: issueIdToken({ email: 'user@example.com', email_verified: false }),
    };

    const identity = await buildProvider({ identifierClaim: 'email' }).handleCallback({ code: 'c' });

    expect(identity.identifier).toBe('user@example.com');
    expect(identity.identifierVerified).toBe(false);
  });

  it('should reject when the configured identifier claim is absent', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({}) };

    await expect(
      buildProvider({ identifierClaim: `missing-${randomUUID()}` }).handleCallback({ code: 'c' }),
    ).rejects.toBeInstanceOf(AuthProviderMisconfiguredError);
  });
});

describe('OidcAuthProvider internal base url', () => {
  const INTERNAL = 'http://localhost:4530/oidc';

  const internalProvider = (): OidcAuthProvider => buildProvider({ internalBaseUrl: INTERNAL });

  it('should fetch discovery through the internal base', async () => {
    await internalProvider().createAuthorizationRequest();

    const discoveryCall = stub.calls.find(call => call.url.includes('.well-known'));

    expect(discoveryCall?.url).toBe(`${INTERNAL}/.well-known/openid-configuration`);
  });

  // The browser has to reach the issuer's public address; rewriting this would
  // send the user agent to a host only reachable from inside the cluster.
  it('should never rewrite the user-facing authorization url', async () => {
    const request = await internalProvider().createAuthorizationRequest();

    expect(request.url.startsWith(`${ISSUER}/auth`)).toBe(true);
    expect(request.url).not.toContain('localhost:4530');
  });

  it('should exchange the code and fetch jwks through the internal base', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({}) };

    await internalProvider().handleCallback({ code: 'c' });

    expect(stub.calls.some(call => call.url === `${INTERNAL}/token`)).toBe(true);
    expect(stub.calls.some(call => call.url === `${INTERNAL}/jwks`)).toBe(true);
    expect(stub.calls.some(call => call.url.startsWith(ISSUER))).toBe(false);
  });

  it('should fetch userinfo through the internal base', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({}) };
    stub.userinfoResponse = { sub: 'subject-1' };

    await buildProvider({ internalBaseUrl: INTERNAL, fetchUserinfo: true }).handleCallback({ code: 'c' });

    expect(stub.calls.some(call => call.url === `${INTERNAL}/me`)).toBe(true);
  });

  it('should still validate the issuer against its public identifier', async () => {
    // The document is served from the internal address but must still declare
    // the public issuer, otherwise id token verification would break.
    stub.discoveryOverride = { ...DISCOVERY, issuer: INTERNAL };

    await expect(internalProvider().createAuthorizationRequest()).rejects.toBeInstanceOf(
      AuthProviderMisconfiguredError,
    );
  });

  it('should leave endpoints published on another origin untouched', async () => {
    stub.discoveryOverride = { ...DISCOVERY, token_endpoint: 'https://tokens.elsewhere.test/token' };
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({}) };

    await internalProvider().handleCallback({ code: 'c' });

    expect(stub.calls.some(call => call.url === 'https://tokens.elsewhere.test/token')).toBe(true);
  });
});
