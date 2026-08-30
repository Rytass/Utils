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

/** Throwaway self-signed pair for the certificate-authentication tests. */
const TEST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDAzCCAeugAwIBAgIUeoL4NZ74LZIebfv8U1SuDrecVU4wDQYJKoZIhvcNAQEL
BQAwETEPMA0GA1UEAwwGcGFpci1hMB4XDTI2MDgzMDE2MzU0M1oXDTM2MDgyNzE2
MzU0M1owETEPMA0GA1UEAwwGcGFpci1hMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
MIIBCgKCAQEAqT7Hih2GBs68El7FUakwWg36StQP3HU+pGL8h7CgMTWehZbHGHwu
Wrp/RoHYdBnwJpJ1WtPtmUFAlkV3XFxahSz+185PZkeR1N+/rvjk3yLkVBFd4orW
S07Z382rBctSc1hzFThcDJJ31QD1c5jPRU+qYigBmwnlySNqUZ16VpMd1h5mLFh3
eLE/pSvxp83O1Hiee/s4uRnb1QOmns+2VqMO1tVjdKlXWFQKl394+eZzbQh+frdQ
+0Qkh3UOfsPg2np+c3GV9rCo2jmsqRaXg2Qm/gp/NZcetXEcpPuYcEK1Qeex2gUq
CHbchpeMvAqmc0LHp20zrOfRPgqk5+YHpwIDAQABo1MwUTAdBgNVHQ4EFgQUYi4K
6bGY/fBaBM9tM+Y8zAov4zAwHwYDVR0jBBgwFoAUYi4K6bGY/fBaBM9tM+Y8zAov
4zAwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAn9ndYcYFC9Tk
dRyHkmEEvbZ0k3/g9bC2wbxc7hMyv4eTD5xYNLfgeDYzQFzpNHv+V3yJUsdpc07d
SmQwS/ZuJJTnV3dPlL/xMsVZ/QDfnBjt7Q4P4MtGm3cpXTqkdRPzqnlGga7tmkWN
mAdQ0JIQtAwYf0iPQBG9exSIj+4tDlrbqTsMnuUQnntgdLfQZq03JTVBjJnFCGUm
LZs9h9H3eg1InITUhV0q09WfvdIyuamNXSoWNDEF//oDAcu+tBWukfwozi1ntcdX
ejN0r7PzvGp8rX5z4+VbsuiEBYWOcg8R7qEyCaTP09+iKx2XM3UIuitf2wdWYvqm
Ns7QCHS8nQ==
-----END CERTIFICATE-----`;

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCpPseKHYYGzrwS
XsVRqTBaDfpK1A/cdT6kYvyHsKAxNZ6FlscYfC5aun9Ggdh0GfAmknVa0+2ZQUCW
RXdcXFqFLP7Xzk9mR5HU37+u+OTfIuRUEV3iitZLTtnfzasFy1JzWHMVOFwMknfV
APVzmM9FT6piKAGbCeXJI2pRnXpWkx3WHmYsWHd4sT+lK/Gnzc7UeJ57+zi5GdvV
A6aez7ZWow7W1WN0qVdYVAqXf3j55nNtCH5+t1D7RCSHdQ5+w+Daen5zcZX2sKja
OaypFpeDZCb+Cn81lx61cRyk+5hwQrVB57HaBSoIdtyGl4y8CqZzQsenbTOs59E+
CqTn5genAgMBAAECggEAAd3Di9nVRsLAdn1zCxYMjY3GZBzKsL2ESjX7YqC983kS
rOLRe2GceSMN7iE+T0fs3CTItO9z3jkPd7mbIbHzH2wfkhjUAmTbKEBzmLBQk2aE
NLE4xAAF0nypGxcxorPv/sobJH9GQHe5p0Hxed+h2iG6oAn6ko3FFuCGeh7/6voH
If+urMTRtc9AMSPmegHVJ78pnax3u98nSh25FbAHGfMCZ9QNOfA1cJTIP+K5v16v
o4yFHSwSARIiqm8Ejhho2atcoyoBdCQqG9KkzlFG1tIYgOfzdulhYT+JByTgcrPi
E3OY80PcFneJrbjixffWixyWfgXQtVzivJzUWm6cqQKBgQDc/6yh0tqJht6a3UUo
/eLYmcYHqq6t0husEIWfdDkmMmJDf8Po4FDny44aRAqDwHZdiCOGw9ZuKmXjZSHu
c49Pc8vUus8LgMe9VDxwsunshA7hKMRPfl/oIBCsFP9QBKDyPvVADslkxCkL3QB+
gc8Bv9UfNwtfa4fJDqStzcb2zQKBgQDEDMaGz4cHBqt05YxeT1VsyjbyM8bNXCH+
aeX8/zTn9ngaLDc4LXPRTG8Ex2XJ3jnCZuRK3+cpWu8GlCqty4p+uRF5I2C2EOyY
FKTOUu/MWPgWum4pJg+xlB+1JkYqpBja3cgNTkEfNsi2liCN+kXDiZnM7fYI2+ji
3IQxZsEwQwKBgHGXBI9EhkkLxl0JACQ6op88IpoMM65qAQkmkNfNcBZe7TzObc7D
hTIu4QJFGLZxdSVL9R6uiAelySrg71jVksJ+vTTBM+wwq/l3U32FqFCF6/P09Tn6
tabk3Ezmmffx+RuqGnprXz5oyMQtOrTLWbAHfq6Fp1XLOkawPRqMWwi9AoGAXX3O
KrnKpaIbn6pcDxl8Hl4sZ8IjOwmFuIKdx9GYVEooKisNxj9+rL/rbXb9ZpAQMVHJ
6p7t6L3RoOyFkc2v5RCycXdahlh5y2iE01OfwW5oGMadBAh/kWqW2FdBPNJ2e+Ep
ppa73XvNqazcJ3jDTiVPb/fGzaC5ZX5NmBVtaWsCgYEAvpqm1q9AgsvQ3uVmgpE8
Ubw5E4N7E9Vh8YFdlS7kvjgkUYnSPNkZcnKjDUSirY9krEv1bPYqlfuKGPByiezI
RbEOEHuzTMhTcntKM/o42f+ir2zto2+etXHMoOencMgbxLwfBM+9LuOQ6f1xUoiZ
lQErIBb8Hq1mKAhDm+JrBj0=
-----END PRIVATE KEY-----`;

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

describe('OidcAuthProvider certificate client authentication', () => {
  const certificate = { certificate: TEST_CERTIFICATE, privateKey: TEST_PRIVATE_KEY };

  const certificateProvider = (): OidcAuthProvider =>
    new OidcAuthProvider({
      channel: 'corp-idp',
      issuer: ISSUER,
      clientId: CLIENT_ID,
      clientCertificate: certificate,
      redirectUri: 'https://app.example.com/auth/callback',
    });

  it('should exchange the code with a client assertion and no secret', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({}) };

    await certificateProvider().handleCallback({ code: 'code-1' });

    const tokenCall = stub.calls.find(call => call.url.endsWith('/token'));
    const body = new URLSearchParams(tokenCall?.init?.body as string);

    expect(body.get('client_assertion_type')).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    expect(typeof body.get('client_assertion')).toBe('string');
    // No shared secret anywhere: not in the body, not in an Authorization header.
    expect(body.get('client_secret')).toBeNull();
    expect((tokenCall?.init?.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('should address the assertion to the endpoint the issuer publishes', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({}) };

    // Back-channel calls go somewhere else entirely; the audience must not
    // follow them, because it is what the issuer verifies against.
    const provider = new OidcAuthProvider({
      channel: 'corp-idp',
      issuer: ISSUER,
      internalBaseUrl: 'http://localhost:4530/oidc',
      clientId: CLIENT_ID,
      clientCertificate: certificate,
      redirectUri: 'https://app.example.com/auth/callback',
    });

    await provider.handleCallback({ code: 'code-1' });

    const tokenCall = stub.calls.find(call => call.url.includes('/token'));
    const assertion = new URLSearchParams(tokenCall?.init?.body as string).get('client_assertion') ?? '';
    const claims = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString('utf8'));

    expect(tokenCall?.url).toBe('http://localhost:4530/oidc/token');
    expect(claims.aud).toBe(`${ISSUER}/token`);
    expect(claims.iss).toBe(CLIENT_ID);
    expect(claims.sub).toBe(CLIENT_ID);
  });

  it('should sign a fresh assertion per exchange rather than caching one', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({}) };

    const provider = certificateProvider();

    await provider.handleCallback({ code: 'code-1' });
    await provider.handleCallback({ code: 'code-2' });

    const assertions = stub.calls
      .filter(call => call.url.endsWith('/token'))
      .map(call => new URLSearchParams(call.init?.body as string).get('client_assertion'));

    expect(assertions).toHaveLength(2);
    expect(assertions[0]).not.toBe(assertions[1]);
  });

  it('should refuse a secret and a certificate together', () => {
    expect(
      () =>
        new OidcAuthProvider({
          channel: 'corp-idp',
          issuer: ISSUER,
          clientId: CLIENT_ID,
          clientSecret: 'sp-secret',
          clientCertificate: certificate,
          redirectUri: 'https://app.example.com/auth/callback',
        }),
    ).toThrow(/both clientSecret and clientCertificate/);
  });

  it('should refuse a mismatched pair at construction', () => {
    expect(
      () =>
        new OidcAuthProvider({
          channel: 'corp-idp',
          issuer: ISSUER,
          clientId: CLIENT_ID,
          clientCertificate: { certificate: TEST_CERTIFICATE, privateKey: 'not a key' },
          redirectUri: 'https://app.example.com/auth/callback',
        }),
    ).toThrow(/clientCertificate\.privateKey is not a readable PEM/);
  });

  it('should leave the secret path exactly as it was', async () => {
    stub.tokenResponse = { access_token: 'at', id_token: issueIdToken({}) };

    await buildProvider().handleCallback({ code: 'code-1' });

    const tokenCall = stub.calls.find(call => call.url.endsWith('/token'));
    const body = new URLSearchParams(tokenCall?.init?.body as string);

    expect((tokenCall?.init?.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from(`${CLIENT_ID}:sp-secret`).toString('base64')}`,
    );

    expect(body.get('client_assertion')).toBeNull();
    expect(body.get('client_assertion_type')).toBeNull();
  });
});
