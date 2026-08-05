import type { ResolvedFusionAuthConfig } from '../typings/auth';
import type { ResolvedFusionClientOptions } from '../typings/client-options';

const DEFAULT_REFRESH_BUFFER_MS = 60 * 1000;

interface OAuthTokenResponse {
  readonly access_token: string;
  readonly expires_in: number;
}

/**
 * Supplies the `Authorization` header for Fusion requests.
 *
 * Covers the strategies Oracle Fusion REST APIs accept: OAuth 2.0 client credentials (with TTL
 * cache and early refresh), a pre-issued JWT, and HTTP Basic. `FusionRestClient` only depends on
 * `getAuthorizationHeader()`, so switching strategy requires no caller changes.
 */
export class FusionAuthProvider {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly options: ResolvedFusionClientOptions) {}

  /** Fusion pod 根位址（已去除尾端斜線）。 */
  getBaseUrl(): string {
    return this.options.baseUrl;
  }

  /** The configured strategy, for diagnostics and tests. */
  getAuthType(): ResolvedFusionAuthConfig['type'] {
    return this.options.auth.type;
  }

  /** 供 `FusionRestClient` 使用的完整 `Authorization` 標頭值。 */
  async getAuthorizationHeader(): Promise<string> {
    const { auth } = this.options;

    switch (auth.type) {
      case 'oauth2_client_credentials':
        return `Bearer ${await this.getAccessToken()}`;

      case 'jwt':
        return `Bearer ${typeof auth.token === 'function' ? await auth.token() : auth.token}`;

      case 'basic':
        return `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`;
    }
  }

  /**
   * 取得有效的 OAuth access token，內建 TTL 快取（於到期前 `refreshBufferMs` 提前換發）。
   * 僅在 `auth.type === 'oauth2_client_credentials'` 時可用。
   */
  async getAccessToken(): Promise<string> {
    const { auth } = this.options;

    if (auth.type !== 'oauth2_client_credentials') {
      throw new Error(`getAccessToken() is only available for oauth2_client_credentials, got ${auth.type}`);
    }

    const refreshBufferMs = auth.refreshBufferMs ?? DEFAULT_REFRESH_BUFFER_MS;

    if (this.accessToken && Date.now() < this.tokenExpiresAt - refreshBufferMs) {
      return this.accessToken;
    }

    const basic = Buffer.from(`${auth.clientId}:${auth.clientSecret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials' });

    const scope = typeof auth.scope === 'string' ? auth.scope : (auth.scope ?? []).join(' ');

    if (scope) {
      body.set('scope', scope);
    }

    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;

    const response = await fetchImpl(auth.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Fusion OAuth token failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as OAuthTokenResponse;

    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    this.options.logger?.debug?.('Fusion OAuth token issued');

    return this.accessToken;
  }

  /** 清除快取的 token，下次呼叫強制重新換發（供憑證輪替後手動失效使用）。 */
  invalidateToken(): void {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }
}
