import type { TypeORMAdapterOptions } from 'typeorm-adapter';
import type { BaseMemberEntity } from '../models/base-member.entity';
import type { ReflectableDecorator } from '@nestjs/core';
import type { Enforcer } from 'casbin';
import type { OAuth2Provider } from './oauth2-provider.interface';

export interface MemberBaseModuleOptionsDto<
  MemberEntity extends BaseMemberEntity = BaseMemberEntity,
  TokenPayload extends Record<string, any> = Pick<
    MemberEntity,
    'id' | 'account'
  >,
> {
  loginFailedBanThreshold?: number; // default: 5
  resetPasswordTokenExpiration?: number; // default: 60 * 60 * 1 = 1 hour
  resetPasswordTokenSecret?: string; // default: random string generated by crypto.randomBytes(16).toString('hex')
  cookieMode?: boolean; // default: false, if true, will use cookie instead of header for token, cookie name: 'token'
  loginFailedAutoUnlockSeconds?: number; // default: null, if set, will enable auto unlock after the specified seconds

  // Tokens
  accessTokenSecret?: string; // default: random string generated by crypto.randomBytes(16).toString('hex')
  accessTokenExpiration?: number; // default: 60 * 15, 15 minutes
  refreshTokenSecret?: string; // default: random string generated by crypto.randomBytes(16).toString('hex')
  refreshTokenExpiration?: number; // default: 60 * 60 * 24 * 90, 90 days
  onlyResetRefreshTokenExpirationByPassword?: boolean; // default: false, if true, will only reset refresh token expiration when password is changed

  // Casbin
  enableGlobalGuard?: boolean; // default: true
  casbinAdapterOptions?: TypeORMAdapterOptions;
  casbinModelString?: string; // default: RBAC with domains
  casbinPermissionDecorator?: ReflectableDecorator<any[]>;
  casbinPermissionChecker?: ({
    enforcer,
    payload,
    actions,
  }: {
    enforcer: Enforcer;
    payload: TokenPayload;
    actions: any[];
  }) => Promise<boolean>;

  // Entities
  memberEntity?: new () => MemberEntity; // default: MemberEntity

  // Password Policy
  passwordShouldIncludeUppercase?: boolean; // default: true
  passwordShouldIncludeLowercase?: boolean; // default: true
  passwordShouldIncludeDigit?: boolean; // default: true
  passwordShouldIncludeSpecialCharacters?: boolean; // default: false
  passwordMinLength?: number; // default: 8
  passwordPolicyRegExp?: RegExp; // default: undefined, if set, will override the above options
  passwordHistoryLimit?: number; // default undefined, if set, will enable password history check
  passwordAgeLimitInDays?: number; // default undefined, if set, will enable password age check
  forceRejectLoginOnPasswordExpired?: boolean; // default: false, if true, will reject login when password is expired
  customizedJwtPayload?: (member: MemberEntity) => TokenPayload; // default: undefined

  // OAuth2
  oauth2Providers?: OAuth2Provider[];
  oauth2ClientDestUrl?: string; // default: '/login'
}
