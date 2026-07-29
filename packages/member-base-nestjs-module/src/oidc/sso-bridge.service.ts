import { Inject, Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { verify as verifyJWT } from 'jsonwebtoken';
import { MemberBaseService } from '../services/member-base.service';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_EXPIRATION,
  ACCESS_TOKEN_SECRET,
  COOKIE_MODE,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRATION,
} from '../typings/member-base.tokens';
import { MEMBER_BASE_OIDC_OPTIONS } from './oidc.tokens';
import type { MemberBaseOidcProviderOptions } from './oidc-provider.options';
import type { BaseMemberEntity } from '../models/base-member.entity';

interface CookieCapableResponse {
  cookie?(name: string, value: string, options: Record<string, unknown>): unknown;
  clearCookie?(name: string, options: Record<string, unknown>): unknown;
}

interface CookieCapableRequest {
  cookies?: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
}

export interface LocalSessionClaims {
  id: string;
  authTime?: number;
}

/**
 * Bridges the provider's own session with the member-base session.
 *
 * An application that is both an issuer and a resource server ends up with two
 * session concepts. Without a bridge, logging in at the interaction page leaves
 * the application's own API believing nobody is signed in, and signing in at
 * the application's login page still forces a second login when a service
 * provider asks for authorization.
 */
@Injectable()
export class OidcSsoBridge implements OnApplicationBootstrap {
  private readonly logger = new Logger(OidcSsoBridge.name);

  constructor(
    @Inject(MEMBER_BASE_OIDC_OPTIONS)
    private readonly options: MemberBaseOidcProviderOptions,
    @Inject(MemberBaseService)
    private readonly memberBaseService: MemberBaseService,
    @Inject(COOKIE_MODE)
    private readonly cookieMode: boolean,
    @Inject(ACCESS_TOKEN_SECRET)
    private readonly accessTokenSecret: string,
    @Inject(ACCESS_TOKEN_EXPIRATION)
    private readonly accessTokenExpiration: number,
    @Inject(REFRESH_TOKEN_EXPIRATION)
    private readonly refreshTokenExpiration: number,
    @Optional()
    @Inject(ACCESS_TOKEN_COOKIE_NAME)
    private readonly accessTokenCookieName: string = 'access_token',
    @Optional()
    @Inject(REFRESH_TOKEN_COOKIE_NAME)
    private readonly refreshTokenCookieName: string = 'refresh_token',
  ) {}

  onApplicationBootstrap(): void {
    if (!this.enabled) return;

    if (this.issueLocalSession && !this.cookieMode) {
      this.logger.warn(
        'ssoBridge.issueLocalSession is enabled but cookieMode is off. A redirect-based login cannot hand a ' +
          'header-bearer token to the browser, so local session issuance is disabled. Enable cookieMode to use it.',
      );
    }
  }

  get enabled(): boolean {
    return this.options.ssoBridge?.enabled ?? true;
  }

  get issueLocalSession(): boolean {
    return this.enabled && (this.options.ssoBridge?.issueLocalSession ?? true);
  }

  get acceptLocalSession(): boolean {
    return this.enabled && (this.options.ssoBridge?.acceptLocalSession ?? true);
  }

  get unifiedLogout(): boolean {
    return this.enabled && (this.options.ssoBridge?.unifiedLogout ?? true);
  }

  /**
   * Issue member-base cookies after a successful interaction login, so the
   * application's own API recognises the same browser.
   */
  issueSession(res: unknown, member: BaseMemberEntity): void {
    if (!this.issueLocalSession || !this.cookieMode) return;

    const response = res as CookieCapableResponse;

    if (typeof response.cookie !== 'function') return;

    const common = { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: this.isSecure() };

    response.cookie(this.accessTokenCookieName, this.memberBaseService.signAccessToken(member), {
      ...common,
      maxAge: this.accessTokenExpiration * 1000,
    });

    response.cookie(this.refreshTokenCookieName, this.memberBaseService.signRefreshToken(member), {
      ...common,
      maxAge: this.refreshTokenExpiration * 1000,
    });
  }

  clearSession(res: unknown): void {
    if (!this.unifiedLogout) return;

    const response = res as CookieCapableResponse;

    if (typeof response.clearCookie !== 'function') return;

    response.clearCookie(this.accessTokenCookieName, { path: '/' });
    response.clearCookie(this.refreshTokenCookieName, { path: '/' });
  }

  /**
   * Decide whether an existing member-base session may stand in for an
   * interactive login.
   *
   * Two request parameters must be honoured or the relying party's own security
   * decisions are silently voided:
   *
   *   prompt=login — the client is explicitly demanding a fresh authentication
   *   max_age      — the client will not accept an authentication older than N
   *
   * A token predating the authTime claim carries no authentication time, so it
   * can never satisfy max_age and correctly falls through to the login page.
   */
  async resolveSkippableLogin(
    req: unknown,
    params: Record<string, unknown>,
  ): Promise<{ member: BaseMemberEntity; authTime?: number } | null> {
    if (!this.acceptLocalSession) return null;

    const prompt = typeof params.prompt === 'string' ? params.prompt.split(' ') : [];

    if (prompt.includes('login')) return null;

    const claims = this.readLocalSession(req);

    if (!claims) return null;

    const maxAge = this.parseMaxAge(params.max_age);

    if (maxAge !== null) {
      // max_age=0 means the client accepts no prior authentication at all,
      // which the specification equates to prompt=login. Comparing timestamps
      // would let a session authenticated within the same second slip through.
      if (maxAge === 0) return null;

      if (claims.authTime === undefined) return null;

      if (claims.authTime < Math.floor(Date.now() / 1000) - maxAge) return null;
    }

    const member = await this.memberBaseService.findById(claims.id);

    return member ? { member, authTime: claims.authTime } : null;
  }

  readLocalSession(req: unknown): LocalSessionClaims | null {
    const token = this.extractToken(req);

    if (!token) return null;

    try {
      const payload = verifyJWT(token, this.accessTokenSecret) as { id?: string; authTime?: number };

      return typeof payload.id === 'string' ? { id: payload.id, authTime: payload.authTime } : null;
    } catch {
      return null;
    }
  }

  private extractToken(req: unknown): string | null {
    const request = req as CookieCapableRequest;
    const authorization = request.headers?.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;

    if (typeof header === 'string' && /^bearer /i.test(header)) {
      return header.slice(7);
    }

    return request.cookies?.[this.accessTokenCookieName] ?? null;
  }

  private parseMaxAge(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;

    const parsed = Number(value);

    // An unparseable max_age is treated as "re-authenticate": failing open here
    // would hand the client a session older than it was willing to accept.
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private isSecure(): boolean {
    return this.options.issuer.startsWith('https://');
  }
}
