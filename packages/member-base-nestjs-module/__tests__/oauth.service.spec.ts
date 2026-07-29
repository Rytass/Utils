import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { OAuthService } from '../src/services/oauth.service';
import { MemberBaseService } from '../src/services/member-base.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { MemberOAuthRecordEntity } from '../src/models/member-oauth-record.entity';
import type { OAuth2Provider } from '../src/typings/oauth2-provider.interface';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
}));

import axios from 'axios';

const mockedAxios = axios as unknown as { post: jest.Mock; get: jest.Mock };

/**
 * Characterization tests for OAuthService.
 *
 * Phase 2 turns these flows into AuthenticationProvider implementations, so the
 * currently observable behaviour is pinned here first — including the parts
 * that are arguably defects (Facebook never checks email verification, custom
 * providers get no identifier normalization, and an unbound external identity
 * silently takes over a local account whose `account` matches).
 */

const GOOGLE_PROVIDER: OAuth2Provider = {
  channel: 'google',
  clientId: 'google-client',
  clientSecret: 'google-secret',
  redirectUri: 'https://app.example.com/callback/google',
};

const FACEBOOK_PROVIDER: OAuth2Provider = {
  channel: 'facebook',
  clientId: 'facebook-client',
  clientSecret: 'facebook-secret',
  redirectUri: 'https://app.example.com/callback/facebook',
};

const CUSTOM_PROVIDER: OAuth2Provider = {
  channel: 'corp',
  clientId: 'corp-client',
  clientSecret: 'corp-secret',
  redirectUri: 'https://app.example.com/callback/corp',
  scope: ['openid', 'email'],
  requestUrl: 'https://corp.example.com/authorize',
  getAccessTokenFromCode: async (code: string): Promise<string> => `at-${code}`,
  getAccountFromAccessToken: async (token: string): Promise<string> => `Alice@Corp.example.com/${token}`,
};

interface Harness {
  readonly service: OAuthService;
  readonly memberRepo: { findOne: jest.Mock };
  readonly recordRepo: { save: jest.Mock; createQueryBuilder: jest.Mock };
  readonly memberBaseService: {
    signAccessToken: jest.Mock;
    signRefreshToken: jest.Mock;
    registerWithoutPassword: jest.Mock;
  };
  readonly setBoundRecord: (record: unknown) => void;
}

const buildHarness = (providers: OAuth2Provider[] = [GOOGLE_PROVIDER, FACEBOOK_PROVIDER, CUSTOM_PROVIDER]): Harness => {
  let boundRecord: unknown = null;

  const queryBuilder = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => boundRecord),
  };

  const recordRepo = {
    save: jest.fn(async (entity: unknown) => entity),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const memberRepo = {
    findOne: jest.fn(async () => null),
  };

  const memberBaseService = {
    signAccessToken: jest.fn((member: BaseMemberEntity) => `access-${member.id}`),
    signRefreshToken: jest.fn((member: BaseMemberEntity) => `refresh-${member.id}`),
    registerWithoutPassword: jest.fn(async (account: string) => [
      { id: `new-${account}`, account } as BaseMemberEntity,
      'generated-password',
    ]),
  };

  const service = new OAuthService(
    providers,
    memberRepo as unknown as Repository<BaseMemberEntity>,
    recordRepo as unknown as Repository<MemberOAuthRecordEntity>,
    memberBaseService as unknown as MemberBaseService,
  );

  return {
    service,
    memberRepo,
    recordRepo,
    memberBaseService,
    setBoundRecord: (record: unknown): void => {
      boundRecord = record;
    },
  };
};

beforeEach(() => {
  mockedAxios.post.mockReset();
  mockedAxios.get.mockReset();
});

describe('OAuthService login url generation', () => {
  it('should build the google authorize url with default scope', async () => {
    const { service } = buildHarness();

    const url = new URL(await service.getGoogleOAuthLoginUrl());

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('google-client');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.has('state')).toBe(false);
  });

  it('should build the facebook authorize url with default scope', async () => {
    const { service } = buildHarness();

    const url = new URL(await service.getFacebookOAuthLoginUrl());

    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v22.0/dialog/oauth');
    expect(url.searchParams.get('scope')).toBe('public_profile email');
  });

  it('should build a custom authorize url from the provider requestUrl', async () => {
    const { service } = buildHarness();

    const url = new URL(await service.getCustomOAuthLoginUrl('corp'));

    expect(url.origin + url.pathname).toBe('https://corp.example.com/authorize');
    expect(url.searchParams.get('scope')).toBe('openid email');
  });

  it('should include state when the provider supplies getState', async () => {
    const { service } = buildHarness([{ ...GOOGLE_PROVIDER, getState: (): string => 'state-123' }]);

    const url = new URL(await service.getGoogleOAuthLoginUrl());

    expect(url.searchParams.get('state')).toBe('state-123');
  });

  it('should throw BadRequestException when the requested provider is missing', async () => {
    const { service } = buildHarness([]);

    await expect(service.getGoogleOAuthLoginUrl()).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getFacebookOAuthLoginUrl()).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getCustomOAuthLoginUrl('corp')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OAuthService google code exchange', () => {
  it('should reject an unverified google email', async () => {
    const { service } = buildHarness();

    mockedAxios.post.mockResolvedValue({ data: { access_token: 'google-at' } });
    mockedAxios.get.mockResolvedValue({ data: { email: 'user@example.com', email_verified: false } });

    await expect(service.loginWithGoogleOAuth2Code('code')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should lowercase the google email before resolving the identity', async () => {
    const { service, memberRepo } = buildHarness();

    mockedAxios.post.mockResolvedValue({ data: { access_token: 'google-at' } });
    mockedAxios.get.mockResolvedValue({ data: { email: 'User@Example.COM', email_verified: true } });

    await service.loginWithGoogleOAuth2Code('code');

    expect(memberRepo.findOne).toHaveBeenCalledWith({ where: { account: 'user@example.com' } });
  });

  it('should pass the state through untouched', async () => {
    const { service } = buildHarness();

    mockedAxios.post.mockResolvedValue({ data: { access_token: 'google-at' } });
    mockedAxios.get.mockResolvedValue({ data: { email: 'user@example.com', email_verified: true } });

    const result = await service.loginWithGoogleOAuth2Code('code', 'state-abc');

    expect(result.state).toBe('state-abc');
  });
});

describe('OAuthService facebook code exchange', () => {
  // Documents a known gap: unlike google, the facebook path never inspects any
  // verification flag before trusting the returned email as an identifier.
  it('should accept a facebook email without any verification check', async () => {
    const { service, memberRepo } = buildHarness();

    mockedAxios.post.mockResolvedValue({ data: { access_token: 'fb-at' } });
    mockedAxios.get.mockResolvedValue({ data: { email: 'Victim@Example.com' } });

    await service.loginWithFacebookOAuth2Code('code');

    expect(memberRepo.findOne).toHaveBeenCalledWith({ where: { account: 'victim@example.com' } });
  });
});

describe('OAuthService custom code exchange', () => {
  it('should use the provider callbacks verbatim without normalizing the identifier', async () => {
    const { service, memberRepo } = buildHarness();

    await service.loginWithCustomOAuth2Code('corp', 'code');

    expect(memberRepo.findOne).toHaveBeenCalledWith({ where: { account: 'Alice@Corp.example.com/at-code' } });
  });

  it('should throw BadRequestException for an unknown channel', async () => {
    const { service } = buildHarness();

    await expect(service.loginWithCustomOAuth2Code('nope', 'code')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OAuthService identity resolution', () => {
  it('should sign tokens for an already bound external identity', async () => {
    const { service, setBoundRecord, memberBaseService, recordRepo } = buildHarness();

    setBoundRecord({ member: { id: 'bound-member', account: 'user@example.com' } });

    mockedAxios.post.mockResolvedValue({ data: { access_token: 'google-at' } });
    mockedAxios.get.mockResolvedValue({ data: { email: 'user@example.com', email_verified: true } });

    const result = await service.loginWithGoogleOAuth2Code('code');

    expect(result.accessToken).toBe('access-bound-member');
    expect(result.refreshToken).toBe('refresh-bound-member');
    expect(recordRepo.save).not.toHaveBeenCalled();
    expect(memberBaseService.registerWithoutPassword).not.toHaveBeenCalled();
  });

  // This is the account takeover surface that Phase 2 exposes as the
  // `linkExistingAccount` option: an unbound external identity silently claims
  // a pre-existing local member whose account string happens to match.
  it('should take over an existing local account whose account matches the identifier', async () => {
    const { service, memberRepo, recordRepo, memberBaseService } = buildHarness();

    memberRepo.findOne.mockResolvedValue({ id: 'existing-member', account: 'user@example.com' });

    mockedAxios.post.mockResolvedValue({ data: { access_token: 'google-at' } });
    mockedAxios.get.mockResolvedValue({ data: { email: 'user@example.com', email_verified: true } });

    const result = await service.loginWithGoogleOAuth2Code('code');

    expect(recordRepo.save).toHaveBeenCalledWith({
      memberId: 'existing-member',
      channel: 'google',
      channelIdentifier: 'user@example.com',
    });

    expect(result.accessToken).toBe('access-existing-member');
    expect(memberBaseService.registerWithoutPassword).not.toHaveBeenCalled();
  });

  it('should provision a new passwordless member when nothing matches', async () => {
    const { service, recordRepo, memberBaseService } = buildHarness();

    mockedAxios.post.mockResolvedValue({ data: { access_token: 'google-at' } });
    mockedAxios.get.mockResolvedValue({ data: { email: 'fresh@example.com', email_verified: true } });

    const result = await service.loginWithGoogleOAuth2Code('code');

    expect(memberBaseService.registerWithoutPassword).toHaveBeenCalledWith('fresh@example.com', {
      shouldUpdatePassword: false,
    });

    expect(recordRepo.save).toHaveBeenCalledWith({
      memberId: 'new-fresh@example.com',
      channel: 'google',
      channelIdentifier: 'fresh@example.com',
    });

    expect(result.accessToken).toBe('access-new-fresh@example.com');
  });

  it('should never pass a casbin domain when signing oauth tokens', async () => {
    const { service, memberBaseService } = buildHarness();

    mockedAxios.post.mockResolvedValue({ data: { access_token: 'google-at' } });
    mockedAxios.get.mockResolvedValue({ data: { email: 'fresh@example.com', email_verified: true } });

    await service.loginWithGoogleOAuth2Code('code');

    expect(memberBaseService.signAccessToken).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }));
    expect(memberBaseService.signAccessToken.mock.calls[0]).toHaveLength(1);
  });
});
