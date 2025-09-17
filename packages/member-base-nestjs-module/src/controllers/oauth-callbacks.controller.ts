import { Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { IsPublic } from '../decorators/is-public.decorator';
import { OAuth2Provider } from '../typings/oauth2-provider.interface';
import {
  COOKIE_MODE,
  OAUTH2_CLIENT_DEST_URL,
  OAUTH2_PROVIDERS,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../typings/member-base.tokens';
import { OAuthService } from '../services/oauth.service';
import type { Response } from 'express';

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
    @Inject(OAuthService)
    private readonly oauthService: OAuthService,
  ) {}

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
          res.cookie(this.accessTokenCookieName, tokenPair.accessToken, {
            httpOnly: true,
            secure: true,
          });

          res.cookie(this.refreshTokenCookieName, tokenPair.refreshToken, {
            httpOnly: true,
            secure: true,
          });

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
          res.cookie(this.accessTokenCookieName, tokenPair.accessToken, {
            httpOnly: true,
            secure: true,
          });

          res.cookie(this.refreshTokenCookieName, tokenPair.refreshToken, {
            httpOnly: true,
            secure: true,
          });

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
          res.cookie(this.accessTokenCookieName, tokenPair.accessToken, {
            httpOnly: true,
            secure: true,
          });

          res.cookie(this.refreshTokenCookieName, tokenPair.refreshToken, {
            httpOnly: true,
            secure: true,
          });

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
