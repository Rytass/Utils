import { sign } from 'jsonwebtoken';
import { OidcSsoBridge } from '../src/oidc/sso-bridge.service';
import { MemberBaseService } from '../src/services/member-base.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import type { MemberBaseOidcProviderOptions } from '../src/oidc/oidc-provider.options';

const ACCESS_TOKEN_SECRET = 'access-secret';
const MEMBER = { id: 'member-1', account: 'alice' } as BaseMemberEntity;

const now = (): number => Math.floor(Date.now() / 1000);

interface Harness {
  readonly bridge: OidcSsoBridge;
  readonly res: { cookie: jest.Mock; clearCookie: jest.Mock };
}

const buildBridge = (options?: {
  ssoBridge?: MemberBaseOidcProviderOptions['ssoBridge'];
  cookieMode?: boolean;
  issuer?: string;
  members?: BaseMemberEntity[];
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
    'access_token',
    'refresh_token',
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
