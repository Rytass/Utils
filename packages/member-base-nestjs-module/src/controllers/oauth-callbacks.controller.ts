import { BadRequestException, Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { readCookie } from '../utils/read-cookie';
import { IsPublic } from '../decorators/is-public.decorator';
import { OAuth2Provider } from '../typings/oauth2-provider.interface';
import {
  ACCESS_TOKEN_EXPIRATION,
  ACCESS_TOKEN_SECRET,
  COOKIE_MODE,
  COOKIE_OPTIONS,
  OAUTH2_CLIENT_DEST_URL,
  OAUTH2_PROVIDERS,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRATION,
} from '../typings/member-base.tokens';
import { OAuthService } from '../services/oauth.service';
import { resolveCookieOptions, type CookieOptionsConfig } from '../utils/resolve-cookie-options';
import type { Response } from 'express';
import type { TokenPairDto } from '../dto/token-pair.dto';

@Controller('/auth')
export class OAuthCallbacksController {
  constructor(
    @Inject(OAUTH2_PROVIDERS)
    private readonly providers: OAuth2Provider[],
    @Inject(OAUTH2_CLIENT_DEST_URL)
    private readonly clientDestUrl: string,
    @Inject(COOKIE_MODE)
    private readonly cookieMode: boolean,
    @Inject(ACCESS_TOKEN_COOKIE_NAME)
    private readonly accessTokenCookieName: string,
    @Inject(REFRESH_TOKEN_COOKIE_NAME)
    private readonly refreshTokenCookieName: string,
    @Inject(COOKIE_OPTIONS)
    private readonly cookieOptions: CookieOptionsConfig,
    @Inject(ACCESS_TOKEN_EXPIRATION)
    private readonly accessTokenExpiration: number,
    @Inject(REFRESH_TOKEN_EXPIRATION)
    private readonly refreshTokenExpiration: number,
    @Inject(OAuthService)
    private readonly oauthService: OAuthService,
    @Inject(ACCESS_TOKEN_SECRET)
    private readonly transactionSecret: string = randomBytes(32).toString('hex'),
  ) {}

  private get transactionKey(): Buffer {
    // A public pre-login transaction must never verify as an access token.
    return createHmac('sha256', this.transactionSecret).update('member-oauth-transaction:v1').digest();
  }

  private transactionOptions(res: Response): ReturnType<typeof resolveCookieOptions> {
    const options = resolveCookieOptions(res.req, this.cookieOptions);

    return { ...options, sameSite: options.sameSite === 'strict' ? 'lax' : options.sameSite };
  }

  private requireCookieMode(): void {
    if (!this.cookieMode)
      throw new BadRequestException('Browser OAuth login requires cookieMode; URL bearer tokens are disabled');
  }

  /**
   * Write the pair as cookies.
   *
   * Shared by all three channels so they cannot drift, and resolved through the
   * same helper as the OIDC session bridge. Each channel previously passed only
   * `httpOnly` and `secure: true`, which left two problems: the hardcoded Secure
   * flag meant nothing was stored at all over plain http during local
   * development, and with no `maxAge` these were session cookies that vanished
   * when the browser closed, unlike the ones the session bridge wrote.
   *
   * `path` was never actually broken — Express fills in `/` when it is omitted —
   * but it is written explicitly now so that `cookiePath` can move it and so
   * that clearing uses the same value.
   */
  private setTokenCookies(res: Response, tokenPair: TokenPairDto): void {
    const common = resolveCookieOptions(res.req, this.cookieOptions);

    res.cookie(this.accessTokenCookieName, tokenPair.accessToken, {
      ...common,
      maxAge: this.accessTokenExpiration * 1000,
    });

    res.cookie(this.refreshTokenCookieName, tokenPair.refreshToken, {
      ...common,
      maxAge: this.refreshTokenExpiration * 1000,
    });
  }

  @Get('/login/:channel')
  @IsPublic()
  async redirectURL(@Param('channel') channel: string, @Res() res: Response): Promise<void> {
    const provider = this.providers.find(p => p.channel === channel);

    if (!provider) {
      throw new NotFoundException();
    }

    this.requireCookieMode();

    const state = randomBytes(32).toString('base64url');
    const transaction = jwt.sign({ state, channel }, this.transactionKey, {
      algorithm: 'HS256',
      audience: 'member-oauth-transaction',
      expiresIn: 600,
    });

    res.cookie('member_oauth_tx', transaction, { ...this.transactionOptions(res), maxAge: 600_000 });

    switch (provider.channel) {
      case 'google': {
        const url = await this.oauthService.getGoogleOAuthLoginUrl(state);

        res.redirect(url);

        break;
      }

      case 'facebook': {
        const url = await this.oauthService.getFacebookOAuthLoginUrl(state);

        res.redirect(url);

        break;
      }

      default: {
        const url = await this.oauthService.getCustomOAuthLoginUrl(channel, state);

        res.redirect(url);

        break;
      }
    }
  }

  @Get('/callbacks/:channel')
  @IsPublic()
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Param('channel') channel: string,
    @Res() res: Response,
  ): Promise<void> {
    this.requireCookieMode();

    const transaction = res.req ? readCookie(res.req, 'member_oauth_tx') : undefined;

    res.clearCookie('member_oauth_tx', this.transactionOptions(res));

    try {
      const claims = jwt.verify(transaction ?? '', this.transactionKey, {
        algorithms: ['HS256'],
        audience: 'member-oauth-transaction',
      }) as { state?: string; channel?: string };

      if (
        typeof code !== 'string' ||
        !code ||
        typeof state !== 'string' ||
        !state ||
        claims.state !== state ||
        claims.channel !== channel
      ) {
        throw new Error('Invalid transaction');
      }
    } catch {
      throw new BadRequestException('Invalid OAuth transaction');
    }

    const provider = this.providers.find(p => p.channel === channel);

    if (!provider) {
      throw new NotFoundException();
    }

    const tokenPair =
      provider.channel === 'google'
        ? await this.oauthService.loginWithGoogleOAuth2Code(code, state)
        : provider.channel === 'facebook'
          ? await this.oauthService.loginWithFacebookOAuth2Code(code, state)
          : await this.oauthService.loginWithCustomOAuth2Code(channel, code, state);

    this.setTokenCookies(res, tokenPair);
    res.redirect(this.clientDestUrl);
  }
}
