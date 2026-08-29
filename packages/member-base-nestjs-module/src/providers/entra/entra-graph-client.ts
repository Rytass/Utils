import { createHash, randomUUID, X509Certificate } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AuthProviderMisconfiguredError, DirectoryRequestFailedError } from '../../constants/errors/base.error';

/** Where the tenant's token endpoint lives. Overridden for the national clouds. */
export const DEFAULT_AUTHORITY_BASE_URL = 'https://login.microsoftonline.com';

/** Where Microsoft Graph lives. Overridden for the national clouds. */
export const DEFAULT_GRAPH_BASE_URL = 'https://graph.microsoft.com';

/**
 * A certificate credential, as an app registration stores it.
 *
 * Both are PEM. The certificate is supplied rather than a thumbprint on
 * purpose: the assertion needs the base64url SHA-256 of the certificate's DER
 * encoding, the portal displays thumbprints in more than one hash and encoding,
 * and asking for "the thumbprint" invites pasting the wrong one — which
 * produces a correct-looking assertion and an `invalid_client` with nothing to
 * debug. It is computed here instead.
 */
export interface EntraClientCertificate {
  /** PEM of the public certificate registered on the application. */
  certificate: string;
  /** PEM of the matching private key. */
  privateKey: string;
}

export interface EntraGraphClientOptions {
  tenantId: string;
  clientId: string;
  clientSecret?: string;
  clientCertificate?: EntraClientCertificate;
  graphBaseUrl?: string;
  authorityBaseUrl?: string;
  /**
   * How many times a throttled or failed request is retried.
   * default: 3 — conservative on purpose; a reconciliation job that hammers a
   * throttled tenant gets throttled harder.
   */
  maxRetries?: number;
  /**
   * Ceiling on a single backoff wait, in milliseconds.
   * default: 30000. Graph can answer `Retry-After: 300` on a badly throttled
   * tenant, and a caller holding a request open for five minutes is almost
   * never what the application wanted. A delay longer than this is not
   * shortened — retrying early only deepens a throttle — it is raised as a
   * `DirectoryRequestFailedError` carrying `retryAfterMs`.
   */
  maxRetryDelayMs?: number;
}

interface TokenResponse {
  readonly access_token: string;
  readonly expires_in: number;
}

interface GraphPage<T> {
  readonly value?: T[];
  readonly '@odata.nextLink'?: string;
}

interface GraphDeltaPage<T> extends GraphPage<T> {
  readonly '@odata.deltaLink'?: string;
}

interface CachedToken {
  readonly value: string;
  /** Epoch milliseconds. Already reduced by the renewal margin. */
  readonly renewAt: number;
}

/**
 * Renew this long before the token actually expires.
 *
 * A token that is valid when the request is written can still be expired when
 * Graph reads it; a minute covers the clock skew and the flight time without
 * making renewals frequent.
 */
const RENEWAL_MARGIN_MS = 60_000;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/** Longest this client will hold a request open waiting out a throttle. */
const DEFAULT_MAX_RETRY_DELAY_MS = 30_000;

const stripTrailingSlash = (url: string): string => url.replace(/\/$/, '');

/**
 * `x5t#S256`: base64url of the SHA-256 over the certificate's DER encoding.
 *
 * Derived from the certificate rather than taken as input, so there is no way
 * to supply the wrong hash or the wrong encoding.
 */
const certificateToX5tS256 = (certificate: string): string => {
  try {
    return createHash('sha256').update(new X509Certificate(certificate).raw).digest('base64url');
  } catch (error) {
    throw new AuthProviderMisconfiguredError(
      `Entra clientCertificate.certificate is not a readable PEM certificate: ${(error as Error).message}`,
    );
  }
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * `Retry-After` is either a delay in seconds or an HTTP date; both are legal
 * and Graph sends both depending on which layer throttled the call.
 */
const parseRetryAfter = (header: string | null): number | null => {
  if (!header) return null;

  const seconds = Number(header);

  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(header);

  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
};

/**
 * The client-credentials half of an Entra integration.
 *
 * Deliberately separate from the OIDC relying-party half: signing a user in and
 * reading the directory are two protocols against two hosts with two sets of
 * permissions, and an application is expected to have one, the other, or both.
 * Everything here is service-to-service — no user is present, and no user
 * consent applies.
 *
 * Nothing beyond the access token is cached, and that token lives only in this
 * instance's memory.
 */
export class EntraGraphClient {
  private token: CachedToken | null = null;
  /** In flight renewals are shared, so a burst of calls buys one token. */
  private pending: Promise<CachedToken> | null = null;

  constructor(private readonly options: EntraGraphClientOptions) {
    if (!options.clientSecret && !options.clientCertificate) {
      throw new AuthProviderMisconfiguredError(
        'Entra directory access needs either clientSecret or clientCertificate; neither was supplied',
      );
    }
  }

  get graphBaseUrl(): string {
    return stripTrailingSlash(this.options.graphBaseUrl ?? DEFAULT_GRAPH_BASE_URL);
  }

  get authorityBaseUrl(): string {
    return stripTrailingSlash(this.options.authorityBaseUrl ?? DEFAULT_AUTHORITY_BASE_URL);
  }

  /** Absolute url for a Graph path such as `/v1.0/users`. */
  url(path: string): string {
    return `${this.graphBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /**
   * One Graph request, with the token attached and throttling absorbed.
   *
   * A 401 costs one extra attempt: the cached token is dropped and the request
   * is replayed once, which covers a token revoked mid-flight or a clock that
   * drifted past the renewal margin. A second 401 is a permissions problem and
   * is raised rather than retried.
   */
  async request<T>(url: string, init?: { headers?: Record<string, string> }): Promise<T> {
    const response = await this.send(url, init);

    return (await response.json()) as T;
  }

  /**
   * Walk a Graph collection to its end, following `@odata.nextLink`.
   *
   * Graph decides the page size, so this is the only correct way to read a
   * collection: a caller that stops at the first page silently reconciles
   * against a truncated directory.
   */
  async collect<T>(url: string, headers?: Record<string, string>): Promise<T[]> {
    const collected: T[] = [];

    let next: string | undefined = url;

    while (next) {
      const page: GraphPage<T> = await this.request<GraphPage<T>>(next, { headers });

      collected.push(...(page.value ?? []));

      next = page['@odata.nextLink'];
    }

    return collected;
  }

  /**
   * Walk a delta collection, which terminates on `@odata.deltaLink` rather than
   * simply running out of `@odata.nextLink`.
   */
  async collectDelta<T>(url: string, headers?: Record<string, string>): Promise<{ value: T[]; deltaLink: string }> {
    const collected: T[] = [];

    let next: string | undefined = url;
    let deltaLink: string | undefined;

    while (next) {
      const page: GraphDeltaPage<T> = await this.request<GraphDeltaPage<T>>(next, { headers });

      collected.push(...(page.value ?? []));

      deltaLink = page['@odata.deltaLink'];
      next = page['@odata.nextLink'];
    }

    if (!deltaLink) {
      // Without it the caller has no way to resume, and returning the entries
      // anyway would hand back a sync that silently cannot be continued.
      throw new DirectoryRequestFailedError(200, 'delta response carried no @odata.deltaLink');
    }

    return { value: collected, deltaLink };
  }

  /** Drop the cached token, so the next call acquires a fresh one. */
  invalidateToken(): void {
    this.token = null;
  }

  private async send(url: string, init?: { headers?: Record<string, string> }): Promise<Response> {
    // Looping rather than recursing: a recursive 401 replay restarted `attempt`
    // at zero, so a 401 followed by throttling got a second full retry budget.
    const maxRetries = this.options.maxRetries ?? 3;

    let attempt = 0;
    let retriedAuth = false;

    for (;;) {
      const accessToken = await this.getAccessToken();

      const response = await fetch(url, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
          ...init?.headers,
        },
      });

      if (response.ok) return response;

      if (response.status === 401 && !retriedAuth) {
        this.invalidateToken();
        // Consume the body so the connection is released before replaying.
        await response.arrayBuffer().catch(() => undefined);

        retriedAuth = true;

        continue;
      }

      if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
        const advertised = parseRetryAfter(response.headers.get('retry-after'));
        const cap = this.options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;

        if (advertised !== null && advertised > cap) {
          // Graph's guidance is to wait the advertised delay; retrying sooner
          // deepens the throttle. Holding a request open for the five minutes a
          // badly throttled tenant can ask for is not acceptable either, so the
          // wait is refused rather than shortened and the delay is handed to the
          // caller, which is the side that can decide to come back later.
          throw new DirectoryRequestFailedError(response.status, await this.readError(response), advertised);
        }

        // Release the connection before waiting; an undrained body holds an
        // undici socket for the whole backoff, and a long reconciliation leaks
        // one per retry.
        await response.arrayBuffer().catch(() => undefined);

        await sleep(Math.min(cap, advertised ?? 2 ** attempt * 1_000));

        attempt += 1;

        continue;
      }

      throw new DirectoryRequestFailedError(response.status, await this.readError(response));
    }
  }

  private async readError(response: Response): Promise<string | undefined> {
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };

      return body.error?.message ?? body.error?.code;
    } catch {
      // An error body that is not JSON tells us nothing the status did not.
      return undefined;
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.renewAt) return this.token.value;

    // A burst of parallel page fetches would otherwise each open their own
    // token request against the same endpoint.
    this.pending ??= this.acquireToken().finally(() => {
      this.pending = null;
    });

    this.token = await this.pending;

    return this.token.value;
  }

  private async acquireToken(): Promise<CachedToken> {
    const tokenEndpoint = `${this.authorityBaseUrl}/${encodeURIComponent(this.options.tenantId)}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.options.clientId,
      // `.default` asks for exactly the application permissions the tenant
      // administrator already consented to. Naming individual scopes here is
      // the delegated-flow spelling and is rejected for client credentials.
      scope: `${this.graphBaseUrl}/.default`,
      ...this.credentialParams(tokenEndpoint),
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new DirectoryRequestFailedError(response.status, await this.readError(response));
    }

    const token = (await response.json()) as TokenResponse;

    if (!token.access_token) {
      throw new DirectoryRequestFailedError(response.status, 'token endpoint returned no access_token');
    }

    const lifetime = Number(token.expires_in) || 0;

    return {
      value: token.access_token,
      // A token whose advertised lifetime is shorter than the margin still gets
      // used; it is simply renewed on the next call.
      renewAt: Date.now() + Math.max(0, lifetime * 1_000 - RENEWAL_MARGIN_MS),
    };
  }

  private credentialParams(tokenEndpoint: string): Record<string, string> {
    if (this.options.clientCertificate) {
      return {
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: this.signClientAssertion(tokenEndpoint, this.options.clientCertificate),
      };
    }

    return { client_secret: this.options.clientSecret as string };
  }

  /**
   * The private-key-JWT client credential (RFC 7523).
   *
   * `alg: PS256` and `x5t#S256` are what Microsoft's current certificate
   * credentials specification calls for; `x5t#S256` is also what tells Entra
   * which registered certificate to verify against, so it is not optional even
   * though the JWT would otherwise be well formed.
   *
   * @see https://learn.microsoft.com/en-us/entra/identity-platform/certificate-credentials
   */
  private signClientAssertion(tokenEndpoint: string, certificate: EntraClientCertificate): string {
    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        aud: tokenEndpoint,
        iss: this.options.clientId,
        sub: this.options.clientId,
        jti: randomUUID(),
        nbf: now,
        iat: now,
        exp: now + 600,
      },
      certificate.privateKey,
      {
        algorithm: 'PS256',
        header: {
          alg: 'PS256',
          typ: 'JWT',
          'x5t#S256': certificateToX5tS256(certificate.certificate),
        } as unknown as jwt.JwtHeader,
      },
    );
  }
}
