import { generateKeyPairSync } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import { EntraAuthProvider } from '../src/providers/entra/entra-auth.provider';

const TENANT = '11111111-2222-3333-4444-555555555555';
const ISSUER = `https://login.microsoftonline.com/${TENANT}/v2.0`;
const CLIENT_ID = 'login-app';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'entra-key';

const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' };

const DISCOVERY = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  jwks_uri: `${ISSUER}/keys`,
};

const jsonResponse = (body: unknown, ok = true): Response =>
  ({ ok, status: ok ? 200 : 400, json: async (): Promise<unknown> => body }) as Response;

let idToken = '';
let calls: string[] = [];

const issueIdToken = (claims: Record<string, unknown>, nonce?: string): string =>
  sign({ iss: ISSUER, aud: CLIENT_ID, sub: 'pairwise-subject', ...(nonce ? { nonce } : {}), ...claims }, privateKey, {
    algorithm: 'RS256',
    expiresIn: 300,
    keyid: KID,
  });

beforeEach(() => {
  calls = [];
  idToken = '';

  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    calls.push(url);

    if (url.includes('.well-known')) return jsonResponse(DISCOVERY);

    if (url.endsWith('/keys')) return jsonResponse({ keys: [jwk] });

    if (url.endsWith('/token')) return jsonResponse({ access_token: 'at', id_token: idToken });

    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
});

const buildProvider = (overrides?: Partial<ConstructorParameters<typeof EntraAuthProvider>[0]>): EntraAuthProvider =>
  new EntraAuthProvider({
    tenantId: TENANT,
    auth: {
      clientId: CLIENT_ID,
      clientSecret: 'login-secret',
      redirectUri: 'https://app.example.com/auth/entra/callback',
      ...overrides?.auth,
    },
    ...overrides,
  });

describe('EntraAuthProvider authorization request', () => {
  it('should derive the tenant issuer and discover against it', async () => {
    const request = await buildProvider().createAuthorizationRequest();

    expect(calls[0]).toBe(`${ISSUER}/.well-known/openid-configuration`);
    expect(new URL(request.url).origin + new URL(request.url).pathname).toBe(`${ISSUER}/authorize`);
    expect(request.codeVerifier).toEqual(expect.any(String));
    expect(request.nonce).toEqual(expect.any(String));
  });

  it('should follow an overridden authority for a national cloud', async () => {
    const chinaIssuer = `https://login.partner.microsoftonline.cn/${TENANT}/v2.0`;

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      calls.push(url);

      if (url.includes('.well-known')) {
        return jsonResponse({ ...DISCOVERY, issuer: chinaIssuer, authorization_endpoint: `${chinaIssuer}/authorize` });
      }

      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const provider = buildProvider({ authorityBaseUrl: 'https://login.partner.microsoftonline.cn' });
    const request = await provider.createAuthorizationRequest();

    expect(request.url.startsWith(`${chinaIssuer}/authorize`)).toBe(true);
  });

  it('should accept an explicit issuer override', async () => {
    const custom = 'https://login.microsoftonline.com/custom/v2.0';

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('.well-known')) {
        return jsonResponse({ ...DISCOVERY, issuer: custom, authorization_endpoint: `${custom}/authorize` });
      }

      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const provider = buildProvider({ auth: { clientId: CLIENT_ID, redirectUri: 'https://app/cb', issuer: custom } });

    await expect(provider.createAuthorizationRequest()).resolves.toMatchObject({
      url: expect.stringContaining(`${custom}/authorize`),
    });
  });

  it('should pass extra authorization parameters through', async () => {
    const provider = buildProvider({
      auth: {
        clientId: CLIENT_ID,
        redirectUri: 'https://app/cb',
        extraAuthorizationParams: { prompt: 'select_account', domain_hint: 'corp.com' },
      },
    });

    const url = new URL((await provider.createAuthorizationRequest()).url);

    expect(url.searchParams.get('prompt')).toBe('select_account');
    expect(url.searchParams.get('domain_hint')).toBe('corp.com');
  });

  it('should refuse getAuthorizationUrl, which cannot carry the PKCE verifier', async () => {
    await expect(buildProvider().getAuthorizationUrl()).rejects.toThrow(/createAuthorizationRequest/);
  });
});

describe('EntraAuthProvider callback', () => {
  it('should bind on oid rather than the pairwise sub', async () => {
    idToken = issueIdToken({ oid: 'object-id-1', preferred_username: 'wang@corp.com', name: 'Wang' });

    const identity = await buildProvider().handleCallback({ code: 'code-1' });

    expect(identity.identifier).toBe('object-id-1');
    // The claim that would have been picked by the OIDC default, and is
    // deliberately not used: it differs per application.
    expect(identity.attributes?.sub).toBe('pairwise-subject');
  });

  it('should mark an oid-based identity as verified', async () => {
    idToken = issueIdToken({ oid: 'object-id-1' });

    const identity = await buildProvider().handleCallback({ code: 'code-1' });

    // No email_verified claim is emitted by Entra; the object id is asserted by
    // the tenant and is not something a user can claim.
    expect(identity.identifierVerified).toBe(true);
  });

  it('should still defer to email_verified when pointed at a mutable claim', async () => {
    idToken = issueIdToken({ oid: 'object-id-1', email: 'wang@corp.com', email_verified: false });

    const provider = buildProvider({
      auth: { clientId: CLIENT_ID, redirectUri: 'https://app/cb', identifierClaim: 'email' },
    });

    const identity = await provider.handleCallback({ code: 'code-1' });

    expect(identity.identifier).toBe('wang@corp.com');
    expect(identity.identifierVerified).toBe(false);
  });

  it('should normalise the claims onto the same attribute names the directory uses', async () => {
    idToken = issueIdToken({
      oid: 'object-id-1',
      preferred_username: 'wang@corp.com',
      name: 'Wang',
      email: 'wang@example.com',
    });

    const identity = await buildProvider().handleCallback({ code: 'code-1' });

    expect(identity.attributes).toMatchObject({
      objectId: 'object-id-1',
      account: 'wang@corp.com',
      name: 'Wang',
      email: 'wang@example.com',
    });
  });

  it('should fall back to preferred_username for the email when no email claim is emitted', async () => {
    idToken = issueIdToken({ oid: 'object-id-1', preferred_username: 'wang@corp.com' });

    const identity = await buildProvider().handleCallback({ code: 'code-1' });

    expect(identity.attributes?.email).toBe('wang@corp.com');
  });

  it('should leave the groups claim alone, since it holds object ids not names', async () => {
    idToken = issueIdToken({ oid: 'object-id-1', groups: ['group-object-id-1'] });

    const identity = await buildProvider().handleCallback({ code: 'code-1' });

    expect(identity.attributes?.groups).toEqual(['group-object-id-1']);
  });

  it('should verify the nonce the caller retained', async () => {
    idToken = issueIdToken({ oid: 'object-id-1' }, 'expected-nonce');

    await expect(buildProvider().handleCallback({ code: 'code-1', nonce: 'other-nonce' })).rejects.toThrow();
    await expect(buildProvider().handleCallback({ code: 'code-1', nonce: 'expected-nonce' })).resolves.toMatchObject({
      identifier: 'object-id-1',
    });
  });

  it('should read the account from a configured claim for a hybrid tenant', async () => {
    idToken = issueIdToken({
      oid: 'object-id-1',
      preferred_username: 'wang@corp.com',
      onprem_sam_account_name: 'wangxx',
    });

    const provider = buildProvider({
      auth: { clientId: CLIENT_ID, redirectUri: 'https://app/cb', accountClaim: 'onprem_sam_account_name' },
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret', accountAttribute: 'onPremisesSamAccountName' },
    });

    const identity = await provider.handleCallback({ code: 'code-1' });

    // Without this the login path reports the UPN while the directory path
    // reports sAMAccountName, and a syncOnAuthenticate handler writing
    // attributes.account back flips the field on every login.
    expect(identity.attributes?.account).toBe('wangxx');
  });

  it('should warn once when the two halves would disagree about the account', async () => {
    idToken = issueIdToken({ oid: 'object-id-1', preferred_username: 'wang@corp.com' });

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const provider = buildProvider({
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret', accountAttribute: 'onPremisesSamAccountName' },
    });

    await provider.handleCallback({ code: 'code-1' });
    await provider.handleCallback({ code: 'code-2' });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('auth.accountClaim'));

    warn.mockRestore();
  });

  it('should warn when a configured account claim is not emitted by the tenant', async () => {
    idToken = issueIdToken({ oid: 'object-id-1', preferred_username: 'wang@corp.com' });

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const provider = buildProvider({
      auth: { clientId: CLIENT_ID, redirectUri: 'https://app/cb', accountClaim: 'typo_or_never_configured' },
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret', accountAttribute: 'onPremisesSamAccountName' },
    });

    const identity = await provider.handleCallback({ code: 'code-1' });

    // The likelier mistake of the two: the claim only exists if the app
    // registration was changed, and its name is that change's choice — so a
    // typo lands here, diverging exactly as the unset case does.
    expect(identity.attributes?.account).toBe('wang@corp.com');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('typo_or_never_configured'));

    warn.mockRestore();
  });

  it('should not accuse a correct app registration when a cloud-only account signs in', async () => {
    idToken = issueIdToken({ oid: 'object-id-1', preferred_username: 'cloud@corp.com' });

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await buildProvider({
      auth: { clientId: CLIENT_ID, redirectUri: 'https://app/cb', accountClaim: 'onprem_sam' },
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret', accountAttribute: 'onPremisesSamAccountName' },
    }).handleCallback({ code: 'code-1' });

    // A cloud-only account has no on-premises identity, so the claim is
    // legitimately absent and the directory half falls back to the UPN too —
    // nothing diverges. Telling an operator to audit the registration would
    // send them to check something that is correct.
    const message = warn.mock.calls[0]?.[0] as string;

    expect(message).toContain('Expected for a cloud-only account');
    expect(message).not.toContain('is not emitting the claim under that name.\n');

    warn.mockRestore();
  });

  it('should not let one warning cause spend the other latch', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    // A hybrid tenant with cloud-only accounts: whichever signs in first must
    // not silence a genuinely mistyped accountClaim for the life of the
    // process. Separate causes, separate latches.
    const configured = buildProvider({
      auth: { clientId: CLIENT_ID, redirectUri: 'https://app/cb', accountClaim: 'onprem_sam' },
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret', accountAttribute: 'onPremisesSamAccountName' },
    });

    const unset = buildProvider({
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret', accountAttribute: 'onPremisesSamAccountName' },
    });

    idToken = issueIdToken({ oid: 'object-id-1', preferred_username: 'cloud@corp.com' });

    await configured.handleCallback({ code: 'code-1' });
    await configured.handleCallback({ code: 'code-2' });
    await unset.handleCallback({ code: 'code-3' });

    // One per cause, and the second cause still reaches the operator.
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1][0]).toContain('no auth.accountClaim is configured');

    warn.mockRestore();
  });

  it('should report a named claim the token never carried, whatever the directory is keyed on', async () => {
    idToken = issueIdToken({ oid: 'object-id-1', preferred_username: 'wang@corp.com' });

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    // A typo is a typo regardless of how the directory half is configured — and
    // with no signal the account silently falls back to the UPN.
    await buildProvider({
      auth: { clientId: CLIENT_ID, redirectUri: 'https://app/cb', accountClaim: 'onprem_sam_acount_name' },
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret' },
    }).handleCallback({ code: 'code-1' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('onprem_sam_acount_name'));

    warn.mockRestore();
  });

  it('should report a named claim the token never carried even with no directory at all', async () => {
    idToken = issueIdToken({ oid: 'object-id-1', preferred_username: 'wang@corp.com' });

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await buildProvider({
      auth: { clientId: CLIENT_ID, redirectUri: 'https://app/cb', accountClaim: 'never_emitted' },
    }).handleCallback({ code: 'code-1' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('never_emitted'));
    // The divergence sentence belongs only where the two halves actually can disagree.
    expect(warn.mock.calls[0][0]).not.toContain('on-premises identity');

    warn.mockRestore();
  });

  it('should stay silent when the directory is keyed on the UPN', async () => {
    idToken = issueIdToken({ oid: 'object-id-1', preferred_username: 'wang@corp.com' });

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await buildProvider({
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret' },
    }).handleCallback({ code: 'code-1' });

    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('should report the configured channel on the identity', async () => {
    idToken = issueIdToken({ oid: 'object-id-1' });

    const identity = await buildProvider({ channel: 'corp-entra' }).handleCallback({ code: 'code-1' });

    expect(identity.channel).toBe('corp-entra');
  });
});
