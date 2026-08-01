import { sign } from 'jsonwebtoken';
import { OidcSsoBridge } from '../src/oidc/sso-bridge.service';
import { MemberBaseService } from '../src/services/member-base.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import type { MemberBaseOidcProviderOptions } from '../src/oidc/oidc-provider.options';
import type { CookieOptionsConfig } from '../src/utils/resolve-cookie-options';

const ACCESS_TOKEN_SECRET = 'access-secret';
const MEMBER = { id: 'member-1', account: 'alice' } as BaseMemberEntity;

const now = (): number => Math.floor(Date.now() / 1000);

interface Harness {
  readonly bridge: OidcSsoBridge;
  readonly res: {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
    req?: { headers?: Record<string, string> };
  };
}

const buildBridge = (options?: {
  ssoBridge?: MemberBaseOidcProviderOptions['ssoBridge'];
  cookieMode?: boolean;
  issuer?: string;
  members?: BaseMemberEntity[];
  cookieNames?: { access: string; refresh: string };
  cookieOptions?: CookieOptionsConfig;
}): Harness => {
  const members = options?.members ?? [MEMBER];

  const memberBaseService = {
    findById: jest.fn(async (id: string) => members.find(member => member.id === id) ?? null),
    signAccessToken: jest.fn(() => 'signed-access'),
    signRefreshToken: jest.fn(() => 'signed-refresh'),
  } as unknown as MemberBaseService;

  const bridge = new OidcSsoBridge(
    {
      issuer: options?.issuer ?? 'https://idp.example.com/oidc',
      ssoBridge: options?.ssoBridge,
    } as MemberBaseOidcProviderOptions,
    memberBaseService,
    options?.cookieMode ?? true,
    ACCESS_TOKEN_SECRET,
    900,
    7776000,
    options?.cookieNames?.access ?? 'access_token',
    options?.cookieNames?.refresh ?? 'refresh_token',
    options?.cookieOptions ?? { path: '/', sameSite: 'lax' },
  );

  return { bridge, res: { cookie: jest.fn(), clearCookie: jest.fn() } };
};

const requestWithToken = (claims: Record<string, unknown>): { cookies: Record<string, string> } => ({
  cookies: { access_token: sign(claims, ACCESS_TOKEN_SECRET, { expiresIn: 900 }) },
});

describe('OidcSsoBridge session issuance', () => {
  it('should set both cookies after an interactive login', () => {
    const { bridge, res } = buildBridge();

    bridge.issueSession(res, MEMBER);

    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'signed-access',
      expect.objectContaining({ httpOnly: true }),
    );

    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'signed-refresh', expect.objectContaining({ path: '/' }));
  });

  it('should mark cookies secure only for an https issuer', () => {
    const { bridge, res } = buildBridge({ issuer: 'http://localhost:3000/oidc' });

    bridge.issueSession(res, MEMBER);

    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'signed-access',
      expect.objectContaining({ secure: false }),
    );
  });

  it('should issue nothing when cookie mode is off', () => {
    // A redirect-based login cannot hand a header-bearer token to a browser.
    const { bridge, res } = buildBridge({ cookieMode: false });

    bridge.issueSession(res, MEMBER);

    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('should issue nothing when the bridge is disabled', () => {
    const { bridge, res } = buildBridge({ ssoBridge: { enabled: false } });

    bridge.issueSession(res, MEMBER);

    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('should clear both cookies on unified logout', () => {
    const { bridge, res } = buildBridge();

    bridge.clearSession(res);

    expect(res.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
  });

  it('should keep cookies when unified logout is disabled', () => {
    const { bridge, res } = buildBridge({ ssoBridge: { unifiedLogout: false } });

    bridge.clearSession(res);

    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});

describe('OidcSsoBridge cookie configuration', () => {
  it('should write the configured names', () => {
    const { bridge, res } = buildBridge({
      cookieNames: { access: 'sid', refresh: 'sid_r' },
    });

    bridge.issueSession(res, MEMBER);

    expect(res.cookie).toHaveBeenCalledWith('sid', 'signed-access', expect.anything());
    expect(res.cookie).toHaveBeenCalledWith('sid_r', 'signed-refresh', expect.anything());
  });

  it('should apply the configured attributes', () => {
    const { bridge, res } = buildBridge({
      cookieOptions: { path: '/app', sameSite: 'strict', domain: '.example.com' },
    });

    bridge.issueSession(res, MEMBER);

    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'signed-access',
      expect.objectContaining({ path: '/app', sameSite: 'strict', domain: '.example.com', httpOnly: true }),
    );
  });

  // A browser only removes a cookie when the path and domain match the ones it
  // was stored under; anything else just writes a second, different cookie.
  it('should clear with exactly the path and domain it set', () => {
    const cookieOptions = { path: '/app', sameSite: 'lax' as const, domain: '.example.com' };
    const { bridge, res } = buildBridge({ cookieOptions });

    bridge.issueSession(res, MEMBER);
    bridge.clearSession(res);

    const [, , setOptions] = res.cookie.mock.calls[0] as [string, string, Record<string, unknown>];
    const [, clearOptions] = res.clearCookie.mock.calls[0] as [string, Record<string, unknown>];

    expect(clearOptions).toEqual({ path: setOptions.path, domain: setOptions.domain });
  });

  it('should clear without a domain when none was set', () => {
    const { bridge, res } = buildBridge();

    bridge.clearSession(res);

    expect(res.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
  });

  it('should take secure from the issuer', () => {
    const secure = buildBridge({ issuer: 'https://idp.example.com/oidc' });

    secure.bridge.issueSession(secure.res, MEMBER);

    expect(secure.res.cookie).toHaveBeenCalledWith(
      'access_token',
      'signed-access',
      expect.objectContaining({ secure: true }),
    );

    const insecure = buildBridge({ issuer: 'http://localhost:3000/oidc' });

    insecure.bridge.issueSession(insecure.res, MEMBER);

    expect(insecure.res.cookie).toHaveBeenCalledWith(
      'access_token',
      'signed-access',
      expect.objectContaining({ secure: false }),
    );
  });

  // nginx sends `Host: localhost` upstream whenever `proxy_set_header Host` is
  // omitted, which is its default. Deriving the flag from that would drop
  // Secure from the session cookie of an https deployment, with nothing to
  // indicate it had happened.
  it('should keep secure from the issuer even when a proxy rewrites the host to localhost', () => {
    const { bridge, res } = buildBridge({ issuer: 'https://idp.example.com/oidc' });

    res.req = { headers: { host: 'localhost:4123' } };

    bridge.issueSession(res, MEMBER);

    expect(res.cookie).toHaveBeenCalledWith('access_token', 'signed-access', expect.objectContaining({ secure: true }));
  });

  it('should let an explicit cookieSecure override the issuer', () => {
    const { bridge, res } = buildBridge({
      issuer: 'http://idp.internal:3000/oidc',
      cookieOptions: { path: '/', sameSite: 'lax', secure: true },
    });

    bridge.issueSession(res, MEMBER);

    expect(res.cookie).toHaveBeenCalledWith('access_token', 'signed-access', expect.objectContaining({ secure: true }));
  });
});

describe('OidcSsoBridge local session acceptance', () => {
  it('should accept a valid local session and skip the login page', async () => {
    const { bridge } = buildBridge();

    const result = await bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1', authTime: now() }), {});

    expect(result?.member.id).toBe('member-1');
  });

  it('should read a bearer token as well as a cookie', async () => {
    const { bridge } = buildBridge();
    const token = sign({ id: 'member-1', authTime: now() }, ACCESS_TOKEN_SECRET, { expiresIn: 900 });

    const result = await bridge.resolveSkippableLogin({ headers: { authorization: `Bearer ${token}` } }, {});

    expect(result?.member.id).toBe('member-1');
  });

  it('should ignore a token signed with the wrong secret', async () => {
    const { bridge } = buildBridge();
    const forged = sign({ id: 'member-1' }, 'wrong-secret', { expiresIn: 900 });

    await expect(bridge.resolveSkippableLogin({ cookies: { access_token: forged } }, {})).resolves.toBeNull();
  });

  it('should return null when there is no local session at all', async () => {
    const { bridge } = buildBridge();

    await expect(bridge.resolveSkippableLogin({ cookies: {} }, {})).resolves.toBeNull();
  });

  it('should return null when the member no longer exists', async () => {
    const { bridge } = buildBridge({ members: [] });

    await expect(bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1' }), {})).resolves.toBeNull();
  });

  it('should return null when acceptance is disabled', async () => {
    const { bridge } = buildBridge({ ssoBridge: { acceptLocalSession: false } });

    await expect(bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1' }), {})).resolves.toBeNull();
  });
});

// These two parameters are how a relying party demands a fresh authentication.
// Honouring them is not optional: silently reusing an old session would void
// the client's own security decision.
describe('OidcSsoBridge specification constraints', () => {
  it('should never skip the login page when prompt=login is requested', async () => {
    const { bridge } = buildBridge();

    await expect(
      bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1', authTime: now() }), { prompt: 'login' }),
    ).resolves.toBeNull();
  });

  it('should honour prompt=login among several prompt values', async () => {
    const { bridge } = buildBridge();

    await expect(
      bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1', authTime: now() }), {
        prompt: 'consent login',
      }),
    ).resolves.toBeNull();
  });

  it('should still skip for an unrelated prompt value', async () => {
    const { bridge } = buildBridge();

    const result = await bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1', authTime: now() }), {
      prompt: 'consent',
    });

    expect(result?.member.id).toBe('member-1');
  });

  it('should accept a session younger than max_age', async () => {
    const { bridge } = buildBridge();

    const result = await bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1', authTime: now() - 30 }), {
      max_age: '300',
    });

    expect(result?.member.id).toBe('member-1');
  });

  it('should reject a session older than max_age', async () => {
    const { bridge } = buildBridge();

    await expect(
      bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1', authTime: now() - 3600 }), { max_age: '300' }),
    ).resolves.toBeNull();
  });

  it('should reject a token with no authTime whenever max_age is requested', async () => {
    // Tokens predating the claim cannot prove when authentication happened, so
    // they must fail closed rather than be assumed fresh.
    const { bridge } = buildBridge();

    await expect(
      bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1' }), { max_age: '300' }),
    ).resolves.toBeNull();
  });

  it('should treat max_age=0 as demanding re-authentication', async () => {
    const { bridge } = buildBridge();

    await expect(
      bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1', authTime: now() - 1 }), { max_age: '0' }),
    ).resolves.toBeNull();
  });

  it('should treat an unparseable max_age as demanding re-authentication', async () => {
    const { bridge } = buildBridge();

    await expect(
      bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1', authTime: now() }), { max_age: 'soon' }),
    ).resolves.toBeNull();
  });

  it('should ignore an absent max_age', async () => {
    const { bridge } = buildBridge();

    const result = await bridge.resolveSkippableLogin(requestWithToken({ id: 'member-1' }), { max_age: '' });

    expect(result?.member.id).toBe('member-1');
  });
});
