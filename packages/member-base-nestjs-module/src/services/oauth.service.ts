import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { OAUTH2_PROVIDERS, RESOLVED_MEMBER_REPO } from '../typings/member-base-providers';
import {
  CustomOAuth2Provider,
  FacebookOAuth2Provider,
  GoogleOAuth2Provider,
  OAuth2Provider,
} from '../typings/oauth2-provider.interface';
import { TokenPairDto } from '../dto/token-pair.dto';
import { MemberOAuthRecordEntity, MemberOAuthRecordRepo } from '../models/member-oauth-record.entity';
import { Repository } from 'typeorm';
import { MemberBaseService } from './member-base.service';
import { BaseMemberEntity } from '../models/base-member.entity';

@Injectable()
export class OAuthService {
  constructor(
    @Inject(OAUTH2_PROVIDERS)
    private readonly providers: OAuth2Provider[],
    @Inject(RESOLVED_MEMBER_REPO)
    private readonly baseMemberRepo: Repository<BaseMemberEntity>,
    @Inject(MemberOAuthRecordRepo)
    private readonly memberOAuthRecordRepo: Repository<MemberOAuthRecordEntity>,
    @Inject(MemberBaseService)
    private readonly memberBaseService: MemberBaseService,
  ) {}

  async getGoogleOAuthLoginUrl(): Promise<string> {
    const provider = this.providers.find(p => p.channel === 'google') as GoogleOAuth2Provider;

    if (!provider) {
      throw new BadRequestException('Google OAuth2 provider not found');
    }

    const state = (await provider.getState?.()) ?? null;

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: (provider.scope ?? ['openid', 'email']).join(' '),
      ...(state ? { state } : {}),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async getFacebookOAuthLoginUrl(): Promise<string> {
    const provider = this.providers.find(p => p.channel === 'facebook') as FacebookOAuth2Provider;

    if (!provider) {
      throw new BadRequestException('Facebook OAuth2 provider not found');
    }

    const state = (await provider.getState?.()) ?? null;

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: (provider.scope ?? ['public_profile', 'email']).join(' '),
      ...(state ? { state } : {}),
    });

    return `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`;
  }

  async getCustomOAuthLoginUrl(channel: string): Promise<string> {
    const provider = this.providers.find(p => p.channel === channel) as CustomOAuth2Provider;

    if (!provider) {
      throw new BadRequestException('OAuth2 provider not found');
    }

    const state = (await provider.getState?.()) ?? null;

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: provider.scope.join(' '),
      ...(state ? { state } : {}),
    });

    return `${provider.requestUrl}?${params.toString()}`;
  }

  async loginWithGoogleOAuth2Code(code: string, state?: string): Promise<TokenPairDto & { state?: string }> {
    const provider = this.providers.find(p => p.channel === 'google') as GoogleOAuth2Provider;

    if (!provider) {
      throw new BadRequestException('Google OAuth2 provider not found');
    }

    const {
      data: { access_token },
    } = await axios.post<{ access_token: string }>('https://oauth2.googleapis.com/token', {
      code,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      redirect_uri: provider.redirectUri,
      grant_type: 'authorization_code',
    });

    const { data } = await axios.get<{
      email: string;
      email_verified: boolean;
    }>('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!data.email_verified) {
      throw new BadRequestException('Email not verified');
    }

    const tokenPair = await this.loginWithOAuthIdentifier('google', data.email.toLowerCase());

    return {
      ...tokenPair,
      state,
    };
  }

  async loginWithFacebookOAuth2Code(code: string, state?: string): Promise<TokenPairDto & { state?: string }> {
    const provider = this.providers.find(p => p.channel === 'facebook') as FacebookOAuth2Provider;

    if (!provider) {
      throw new BadRequestException('Facebook OAuth2 provider not found');
    }

    const {
      data: { access_token },
    } = await axios.post<{ access_token: string }>('https://graph.facebook.com/v22.0/oauth/access_token', {
      code,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      redirect_uri: provider.redirectUri,
    });

    const { data } = await axios.get<{ email: string }>(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${access_token}`,
    );

    const tokenPair = await this.loginWithOAuthIdentifier('facebook', data.email.toLowerCase());

    return {
      ...tokenPair,
      state,
    };
  }

  async loginWithCustomOAuth2Code(
    channel: string,
    code: string,
    state?: string,
  ): Promise<TokenPairDto & { state?: string }> {
    const provider = this.providers.find(p => p.channel === channel) as CustomOAuth2Provider;

    if (!provider) {
      throw new BadRequestException('OAuth2 provider not found');
    }

    const accessToken = await provider.getAccessTokenFromCode(code);
    const account = await provider.getAccountFromAccessToken(accessToken);
    const tokenPair = await this.loginWithOAuthIdentifier(channel, account);

    return {
      ...tokenPair,
      state,
    };
  }

  private async loginWithOAuthIdentifier(channel: string, identifier: string): Promise<TokenPairDto> {
    const qb = this.memberOAuthRecordRepo.createQueryBuilder('oauthRecords');

    qb.innerJoinAndSelect('oauthRecords.member', 'member');
    qb.andWhere('oauthRecords.channel = :channel', { channel });
    qb.andWhere('oauthRecords.channelIdentifier = :channelIdentifier', {
      channelIdentifier: identifier,
    });

    const oauthRecord = await qb.getOne();

    if (oauthRecord) {
      return {
        accessToken: this.memberBaseService.signAccessToken(oauthRecord.member),
        refreshToken: this.memberBaseService.signRefreshToken(oauthRecord.member),
      };
    } else {
      const existedUnbindMember = await this.baseMemberRepo.findOne({
        where: {
          account: identifier,
        },
      });

      if (existedUnbindMember) {
        await this.memberOAuthRecordRepo.save({
          memberId: existedUnbindMember.id,
          channel,
          channelIdentifier: identifier,
        });

        return {
          accessToken: this.memberBaseService.signAccessToken(existedUnbindMember),
          refreshToken: this.memberBaseService.signRefreshToken(existedUnbindMember),
        };
      }

      const [member] = await this.memberBaseService.registerWithoutPassword(identifier, {
        shouldUpdatePassword: false,
      });

      await this.memberOAuthRecordRepo.save({
        memberId: member.id,
        channel,
        channelIdentifier: identifier,
      });

      return {
        accessToken: this.memberBaseService.signAccessToken(member),
        refreshToken: this.memberBaseService.signRefreshToken(member),
      };
    }
  }
}
