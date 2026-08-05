import { FusionAuthProvider, resolveFusionClientOptions } from '@rytass/erp-oracle-fusion';
import type { FusionClientOptions } from '@rytass/erp-oracle-fusion';

/** Authorization header generation for both supported strategies, plus OAuth token caching. */

function buildProvider(options: FusionClientOptions): FusionAuthProvider {
  return new FusionAuthProvider(resolveFusionClientOptions(options));
}

function tokenFetch(token: string, expiresIn: number): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ access_token: token, expires_in: expiresIn }),
    text: async () => '',
  });
}

const OAUTH_OPTIONS = (fetchImpl: jest.Mock): FusionClientOptions => ({
  baseUrl: 'https://pod.example.com/',
  auth: {
    type: 'oauth2_client_credentials',
    tokenUrl: 'https://idcs.example.com/oauth2/v1/token',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    scope: 'urn:opc:resource:consumer::all',
  },
  fetchImpl: fetchImpl as unknown as typeof fetch,
});

describe('FusionAuthProvider', () => {
  it('去除 baseUrl 尾端斜線', () => {
    expect(buildProvider(OAUTH_OPTIONS(tokenFetch('t', 3600))).getBaseUrl()).toBe('https://pod.example.com');
  });

  it('OAuth：以 Basic 憑證換發並回傳 Bearer 標頭', async () => {
    const fetchImpl = tokenFetch('tok-1', 3600);
    const provider = buildProvider(OAUTH_OPTIONS(fetchImpl));

    expect(await provider.getAuthorizationHeader()).toBe('Bearer tok-1');

    const [url, init] = fetchImpl.mock.calls[0];

    expect(url).toBe('https://idcs.example.com/oauth2/v1/token');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('client-id:client-secret').toString('base64')}`);
    expect(init.body).toContain('grant_type=client_credentials');
    expect(init.body).toContain('scope=');
  });

  it('OAuth：未設定 scope 時不送該參數', async () => {
    const fetchImpl = tokenFetch('tok-1', 3600);
    const provider = buildProvider({
      baseUrl: 'https://pod.example.com',
      auth: { type: 'oauth2_client_credentials', tokenUrl: 'https://t', clientId: 'a', clientSecret: 'b' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await provider.getAccessToken();

    expect(fetchImpl.mock.calls[0][1].body).not.toContain('scope=');
  });

  it('OAuth：TTL 內重用 token，進入緩衝區後重新換發', async () => {
    const cached = tokenFetch('tok-1', 3600);
    const cachedProvider = buildProvider(OAUTH_OPTIONS(cached));

    await cachedProvider.getAccessToken();
    await cachedProvider.getAccessToken();
    expect(cached).toHaveBeenCalledTimes(1);

    // expires_in 30 秒 < 預設 60 秒緩衝 → 每次都必須重新換發
    const expiring = tokenFetch('tok-2', 30);
    const expiringProvider = buildProvider(OAUTH_OPTIONS(expiring));

    await expiringProvider.getAccessToken();
    await expiringProvider.getAccessToken();
    expect(expiring).toHaveBeenCalledTimes(2);
  });

  it('OAuth：invalidateToken 後強制重新換發', async () => {
    const fetchImpl = tokenFetch('tok-1', 3600);
    const provider = buildProvider(OAUTH_OPTIONS(fetchImpl));

    await provider.getAccessToken();
    provider.invalidateToken();
    await provider.getAccessToken();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('OAuth：換發失敗時帶出 Fusion 回應內容', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid_client' });

    await expect(
      buildProvider({
        ...OAUTH_OPTIONS(fetchImpl),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }).getAccessToken(),
    ).rejects.toThrow('Fusion OAuth token failed: 401');
  });

  it('Basic：不發任何網路請求', async () => {
    const fetchImpl = jest.fn();
    const provider = buildProvider({
      baseUrl: 'https://pod.example.com',
      auth: { type: 'basic', username: 'u', password: 'p' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(await provider.getAuthorizationHeader()).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(provider.getAuthType()).toBe('basic');
  });

  it('OAuth：scope 可傳陣列，依 RFC 6749 以空格串接', async () => {
    const fetchImpl = tokenFetch('tok-1', 3600);
    const provider = buildProvider({
      baseUrl: 'https://pod.example.com',
      auth: {
        tokenUrl: 'https://t',
        clientId: 'a',
        clientSecret: 'b',
        scope: ['urn:opc:resource:consumer::all', 'https://pod/custom'],
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await provider.getAccessToken();

    const body = new URLSearchParams(fetchImpl.mock.calls[0][1].body as string);

    expect(body.get('scope')).toBe('urn:opc:resource:consumer::all https://pod/custom');
  });

  it('OAuth：空陣列 scope 視同未設定', async () => {
    const fetchImpl = tokenFetch('tok-1', 3600);
    const provider = buildProvider({
      baseUrl: 'https://pod.example.com',
      auth: { tokenUrl: 'https://t', clientId: 'a', clientSecret: 'b', scope: [] },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await provider.getAccessToken();

    expect(fetchImpl.mock.calls[0][1].body).not.toContain('scope=');
  });

  it('JWT：直接以既有 token 組 Bearer 標頭，不發網路請求', async () => {
    const fetchImpl = jest.fn();
    const provider = buildProvider({
      baseUrl: 'https://pod.example.com',
      auth: { type: 'jwt', token: 'eyJhbGciOi.payload.sig' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(await provider.getAuthorizationHeader()).toBe('Bearer eyJhbGciOi.payload.sig');
    expect(provider.getAuthType()).toBe('jwt');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('JWT：token 為函式時每次呼叫重新取得（供短效 token 換發）', async () => {
    let issued = 0;
    const provider = buildProvider({
      baseUrl: 'https://pod.example.com',
      auth: {
        type: 'jwt',
        token: async () => {
          issued += 1;

          return `token-${issued}`;
        },
      },
    });

    expect(await provider.getAuthorizationHeader()).toBe('Bearer token-1');
    expect(await provider.getAuthorizationHeader()).toBe('Bearer token-2');
  });

  it('JWT：同步函式亦可', async () => {
    const provider = buildProvider({
      baseUrl: 'https://pod.example.com',
      auth: { type: 'jwt', token: () => 'sync-token' },
    });

    expect(await provider.getAuthorizationHeader()).toBe('Bearer sync-token');
  });

  it('省略 type 時預設為 OAuth 2.0 client credentials', async () => {
    const fetchImpl = tokenFetch('tok-default', 3600);
    const provider = buildProvider({
      baseUrl: 'https://pod.example.com',
      // 刻意不寫 type
      auth: { tokenUrl: 'https://idcs.example.com/oauth2/v1/token', clientId: 'a', clientSecret: 'b' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(provider.getAuthType()).toBe('oauth2_client_credentials');
    expect(await provider.getAuthorizationHeader()).toBe('Bearer tok-default');
  });

  it.each([
    ['basic', { type: 'basic' as const, username: 'u', password: 'p' }],
    ['jwt', { type: 'jwt' as const, token: 't' }],
  ])('非 OAuth 設定（%s）呼叫 getAccessToken 時明確報錯', async (_name, auth) => {
    const provider = buildProvider({ baseUrl: 'https://pod.example.com', auth });

    await expect(provider.getAccessToken()).rejects.toThrow('only available for oauth2_client_credentials');
  });
});
