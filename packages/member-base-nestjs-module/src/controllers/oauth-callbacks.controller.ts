import { Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { IsPublic } from '../decorators/is-public.decorator';
import { OAuth2Provider } from '../typings/oauth2-provider.interface';
import {
  ACCESS_TOKEN_EXPIRATION,
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
  ) {}

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

    switch (provider.channel) {
      case 'google': {
        const url = await this.oauthService.getGoogleOAuthLoginUrl();

        res.redirect(url);

        break;
      }

      case 'facebook': {
        const url = await this.oauthService.getFacebookOAuthLoginUrl();

        res.redirect(url);

        break;
      }

      default: {
        const url = await this.oauthService.getCustomOAuthLoginUrl(channel);

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
    const provider = this.providers.find(p => p.channel === channel);

    if (!provider) {
      throw new NotFoundException();
    }

    switch (provider.channel) {
      case 'google': {
        const tokenPair = await this.oauthService.loginWithGoogleOAuth2Code(code, state);

        if (this.cookieMode) {
          this.setTokenCookies(res, tokenPair);

          res.redirect(this.clientDestUrl);
        } else {
          res.redirect(
            `${this.clientDestUrl}?accessToken=${tokenPair.accessToken}&refreshToken=${tokenPair.refreshToken}${tokenPair.state ? `&state=${tokenPair.state}` : ''}`,
          );
        }

        break;
      }

      case 'facebook': {
        const tokenPair = await this.oauthService.loginWithFacebookOAuth2Code(code, state);

        if (this.cookieMode) {
          this.setTokenCookies(res, tokenPair);

          res.redirect(this.clientDestUrl);
        } else {
          res.redirect(
            `${this.clientDestUrl}?accessToken=${tokenPair.accessToken}&refreshToken=${tokenPair.refreshToken}${tokenPair.state ? `&state=${tokenPair.state}` : ''}`,
          );
        }

        break;
      }

      default: {
        const tokenPair = await this.oauthService.loginWithCustomOAuth2Code(channel, code, state);

        if (this.cookieMode) {
          this.setTokenCookies(res, tokenPair);

          res.redirect(this.clientDestUrl);
        } else {
          res.redirect(
            `${this.clientDestUrl}?accessToken=${tokenPair.accessToken}&refreshToken=${tokenPair.refreshToken}${tokenPair.state ? `&state=${tokenPair.state}` : ''}`,
          );
        }

        break;
      }
    }
  }
}
