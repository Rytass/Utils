import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DeepPartial, Repository } from 'typeorm';
import { BaseMemberEntity } from '../models/base-member.entity';
import { MemberOAuthRecordEntity, MemberOAuthRecordRepo } from '../models/member-oauth-record.entity';
import { MemberBaseService } from './member-base.service';
import {
  AUTH_PROVIDERS,
  AUTO_PROVISION,
  LINK_EXISTING_ACCOUNT,
  RESOLVED_MEMBER_REPO,
} from '../typings/member-base.tokens';
import type {
  AuthContext,
  AuthenticatedIdentity,
  AuthenticationProvider,
  AutoProvisionStrategy,
  LinkExistingAccountStrategy,
} from '../typings/authentication-provider.interface';
import {
  AuthProviderMisconfiguredError,
  AuthProviderNotFoundError,
  ExternalIdentityNotLinkedError,
} from '../constants/errors/base.error';
import { TokenPairDto } from '../dto/token-pair.dto';

export { PASSWORD_CHANNEL } from '../constants/password-channel';

export interface AuthenticationResult<MemberEntity extends BaseMemberEntity = BaseMemberEntity> {
  readonly member: MemberEntity;
  readonly identity: AuthenticatedIdentity;
}

/**
 * Single entry point for authenticating a member, whatever proved its identity.
 *
 * Providers answer "who is this subject"; the gateway maps that answer onto a
 * local member — the record every Casbin rule, token and audit trail hangs off
 * — and applies the provisioning and account-linking policy.
 */
@Injectable()
export class AuthenticationGateway<
  MemberEntity extends BaseMemberEntity = BaseMemberEntity,
> implements OnApplicationBootstrap {
  constructor(
    @Inject(AUTH_PROVIDERS)
    private readonly providers: AuthenticationProvider[],
    @Inject(RESOLVED_MEMBER_REPO)
    private readonly baseMemberRepo: Repository<BaseMemberEntity>,
    @Inject(MemberOAuthRecordRepo)
    private readonly externalIdentityRepo: Repository<MemberOAuthRecordEntity>,
    @Inject(MemberBaseService)
    private readonly memberBaseService: MemberBaseService<MemberEntity>,
    @Inject(AUTO_PROVISION)
    private readonly autoProvision: AutoProvisionStrategy,
    @Inject(LINK_EXISTING_ACCOUNT)
    private readonly linkExistingAccount: LinkExistingAccountStrategy,
  ) {}

  onApplicationBootstrap(): void {
    if (this.linkExistingAccount === false) return;

    const qualifier = this.linkExistingAccount === 'verified-only' ? "'verified-only'" : 'true';

    // Deliberately console.warn rather than the Nest logger: this has to be
    // visible even when the host application silences or replaces the logger.
    console.warn(
      [
        `[MemberBase] linkExistingAccount is enabled (${qualifier}).`,
        'An external identity whose identifier matches an existing local account will take over that account.',
        this.linkExistingAccount === true
          ? 'Any provider that does not verify its identifier (an unverified email, for example) therefore allows account takeover.'
          : 'Only identities the provider reported as verified may link.',
        "Set linkExistingAccount: 'verified-only' to require verification, or false to disable linking entirely.",
      ].join(' '),
    );
  }

  getProvider(channel: string): AuthenticationProvider {
    const provider = this.providers.find(candidate => candidate.channel === channel);

    if (!provider) {
      throw new AuthProviderNotFoundError(channel);
    }

    return provider;
  }

  listProviders(): readonly AuthenticationProvider[] {
    return this.providers;
  }

  /**
   * Authenticate through a credential provider and resolve the local member.
   */
  async authenticate(
    channel: string,
    credentials: unknown,
    context?: AuthContext,
  ): Promise<AuthenticationResult<MemberEntity>> {
    const provider = this.getProvider(channel);

    if (!provider.authenticate) {
      throw new AuthProviderMisconfiguredError(`Provider "${channel}" does not support direct authentication`);
    }

    const identity = await provider.authenticate(credentials, context);

    return this.resolve(identity);
  }

  /**
   * Complete a redirect provider's callback and resolve the local member.
   */
  async handleCallback(
    channel: string,
    params: Record<string, string>,
    context?: AuthContext,
  ): Promise<AuthenticationResult<MemberEntity>> {
    const provider = this.getProvider(channel);

    if (!provider.handleCallback) {
      throw new AuthProviderMisconfiguredError(`Provider "${channel}" does not support callbacks`);
    }

    const identity = await provider.handleCallback(params, context);

    return this.resolve(identity);
  }

  async getAuthorizationUrl(channel: string, state: string, context?: AuthContext): Promise<string> {
    const provider = this.getProvider(channel);

    if (!provider.getAuthorizationUrl) {
      throw new AuthProviderMisconfiguredError(`Provider "${channel}" does not support authorization urls`);
    }

    return provider.getAuthorizationUrl(state, context);
  }

  /**
   * Authenticate and issue a member-base token pair.
   */
  async login(channel: string, credentials: unknown, context?: AuthContext): Promise<TokenPairDto> {
    const { member } = await this.authenticate(channel, credentials, context);

    return {
      accessToken: this.memberBaseService.signAccessToken(member, context?.domain),
      refreshToken: this.memberBaseService.signRefreshToken(member, context?.domain),
    };
  }

  /**
   * Map an authenticated identity onto a local member, provisioning or linking
   * along the way when policy allows it.
   */
  async resolve(identity: AuthenticatedIdentity): Promise<AuthenticationResult<MemberEntity>> {
    const member = await this.resolveMember(identity);

    return { member, identity };
  }

  private async resolveMember(identity: AuthenticatedIdentity): Promise<MemberEntity> {
    // The password provider authenticates the member record itself, so there is
    // nothing to map: no external binding row, no provisioning decision.
    if (identity.memberId) {
      const member = await this.memberBaseService.findById(identity.memberId);

      if (!member) {
        throw new ExternalIdentityNotLinkedError();
      }

      return member;
    }

    const bound = await this.findBoundMember(identity);

    if (bound) return bound;

    const linked = await this.linkToExistingAccount(identity);

    if (linked) return linked;

    return this.provisionMember(identity);
  }

  private async findBoundMember(identity: AuthenticatedIdentity): Promise<MemberEntity | null> {
    const record = await this.externalIdentityRepo.findOne({
      where: { channel: identity.channel, channelIdentifier: identity.identifier },
    });

    if (!record) return null;

    const member = await this.memberBaseService.findById(record.memberId);

    if (!member) {
      throw new ExternalIdentityNotLinkedError();
    }

    return member;
  }

  private async linkToExistingAccount(identity: AuthenticatedIdentity): Promise<MemberEntity | null> {
    if (this.linkExistingAccount === false) return null;

    if (this.linkExistingAccount === 'verified-only' && identity.identifierVerified !== true) {
      return null;
    }

    const existing = await this.baseMemberRepo.findOne({ where: { account: identity.identifier } });

    if (!existing) return null;

    await this.bind(existing.id, identity);

    console.warn(
      `[MemberBase] External identity linked to existing account: channel=${identity.channel} ` +
        `identifier=${identity.identifier} memberId=${existing.id} verified=${identity.identifierVerified === true}`,
    );

    return existing as MemberEntity;
  }

  private async provisionMember(identity: AuthenticatedIdentity): Promise<MemberEntity> {
    if (this.autoProvision === false) {
      throw new ExternalIdentityNotLinkedError();
    }

    if (typeof this.autoProvision === 'function') {
      const memberId = await this.autoProvision(identity);

      if (!memberId) {
        throw new ExternalIdentityNotLinkedError();
      }

      const member = await this.memberBaseService.findById(memberId);

      if (!member) {
        throw new ExternalIdentityNotLinkedError();
      }

      await this.bind(member.id, identity);

      return member;
    }

    // shouldUpdatePassword is declared on BaseMemberEntity, but MemberEntity is
    // an unresolved type parameter here so the compiler cannot see it through
    // DeepPartial<Omit<MemberEntity, ...>>.
    const memberOptions = { shouldUpdatePassword: false } as DeepPartial<Omit<MemberEntity, 'account' | 'password'>>;

    const [member] = await this.memberBaseService.registerWithoutPassword(identity.identifier, memberOptions);

    await this.bind(member.id, identity);

    return member;
  }

  private async bind(memberId: string, identity: AuthenticatedIdentity): Promise<void> {
    await this.externalIdentityRepo.save({
      memberId,
      channel: identity.channel,
      channelIdentifier: identity.identifier,
    });
  }
}
