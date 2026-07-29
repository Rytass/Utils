import { Repository } from 'typeorm';
import { AuthenticationGateway } from '../src/services/authentication-gateway.service';
import { PASSWORD_CHANNEL } from '../src/constants/password-channel';
import { MemberBaseService } from '../src/services/member-base.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { MemberOAuthRecordEntity } from '../src/models/member-oauth-record.entity';
import {
  AuthProviderMisconfiguredError,
  AuthProviderNotFoundError,
  ExternalIdentityNotLinkedError,
} from '../src/constants/errors/base.error';
import type {
  AuthenticatedIdentity,
  AuthenticationProvider,
  AutoProvisionStrategy,
  LinkExistingAccountStrategy,
} from '../src/typings/authentication-provider.interface';

const asMember = (id: string, account: string): BaseMemberEntity => ({ id, account }) as BaseMemberEntity;

const directoryIdentity = (overrides?: Partial<AuthenticatedIdentity>): AuthenticatedIdentity => ({
  channel: 'ldap',
  identifier: 'guid-1',
  ...overrides,
});

interface Harness {
  readonly gateway: AuthenticationGateway;
  readonly members: Map<string, BaseMemberEntity>;
  readonly bindings: MemberOAuthRecordEntity[];
  readonly recordRepo: { findOne: jest.Mock; save: jest.Mock };
  readonly memberRepo: { findOne: jest.Mock };
  readonly registerWithoutPassword: jest.Mock;
}

const buildGateway = (options?: {
  providers?: AuthenticationProvider[];
  autoProvision?: AutoProvisionStrategy;
  linkExistingAccount?: LinkExistingAccountStrategy;
  seedMembers?: BaseMemberEntity[];
  seedBindings?: MemberOAuthRecordEntity[];
}): Harness => {
  const members = new Map<string, BaseMemberEntity>((options?.seedMembers ?? []).map(member => [member.id, member]));
  const bindings: MemberOAuthRecordEntity[] = [...(options?.seedBindings ?? [])];

  const recordRepo = {
    findOne: jest.fn(async ({ where }: { where: { channel: string; channelIdentifier: string } }) =>
      bindings.find(
        binding => binding.channel === where.channel && binding.channelIdentifier === where.channelIdentifier,
      ),
    ),
    save: jest.fn(async (entity: MemberOAuthRecordEntity) => {
      bindings.push(entity);

      return entity;
    }),
  };

  const memberRepo = {
    findOne: jest.fn(async ({ where }: { where: { account?: string } }) =>
      [...members.values()].find(member => member.account === where.account),
    ),
  };

  const registerWithoutPassword = jest.fn(async (account: string) => {
    const member = asMember(`provisioned-${account}`, account);

    members.set(member.id, member);

    return [member, 'generated'];
  });

  const memberBaseService = {
    findById: jest.fn(async (id: string) => members.get(id) ?? null),
    registerWithoutPassword,
    signAccessToken: jest.fn((member: BaseMemberEntity) => `access-${member.id}`),
    signRefreshToken: jest.fn((member: BaseMemberEntity) => `refresh-${member.id}`),
  };

  const gateway = new AuthenticationGateway(
    options?.providers ?? [],
    memberRepo as unknown as Repository<BaseMemberEntity>,
    recordRepo as unknown as Repository<MemberOAuthRecordEntity>,
    memberBaseService as unknown as MemberBaseService,
    options?.autoProvision ?? true,
    options?.linkExistingAccount ?? true,
  );

  return { gateway, members, bindings, recordRepo, memberRepo, registerWithoutPassword };
};

describe('AuthenticationGateway provider dispatch', () => {
  it('should throw AuthProviderNotFoundError for an unregistered channel', async () => {
    const { gateway } = buildGateway();

    await expect(gateway.authenticate('nope', {})).rejects.toBeInstanceOf(AuthProviderNotFoundError);
  });

  it('should reject direct authentication on a redirect-only provider', async () => {
    const redirectOnly: AuthenticationProvider = {
      channel: 'google',
      kind: 'redirect',
      getAuthorizationUrl: async (): Promise<string> => 'https://accounts.google.com',
    };

    const { gateway } = buildGateway({ providers: [redirectOnly] });

    await expect(gateway.authenticate('google', {})).rejects.toBeInstanceOf(AuthProviderMisconfiguredError);
  });

  it('should reject a callback on a provider that has no callback handler', async () => {
    const credentialOnly: AuthenticationProvider = {
      channel: PASSWORD_CHANNEL,
      kind: 'credential',
      authenticate: async (): Promise<AuthenticatedIdentity> => directoryIdentity(),
    };

    const { gateway } = buildGateway({ providers: [credentialOnly] });

    await expect(gateway.handleCallback(PASSWORD_CHANNEL, {})).rejects.toBeInstanceOf(AuthProviderMisconfiguredError);
  });

  it('should expose the registered providers', () => {
    const provider: AuthenticationProvider = { channel: 'ldap', kind: 'credential' };
    const { gateway } = buildGateway({ providers: [provider] });

    expect(gateway.listProviders()).toHaveLength(1);
    expect(gateway.getProvider('ldap')).toBe(provider);
  });
});

describe('AuthenticationGateway member resolution', () => {
  it('should return the member directly when the identity already carries memberId', async () => {
    const member = asMember('m-1', 'alice');
    const { gateway, recordRepo } = buildGateway({ seedMembers: [member] });

    const result = await gateway.resolve({ channel: PASSWORD_CHANNEL, identifier: 'alice', memberId: 'm-1' });

    expect(result.member.id).toBe('m-1');
    expect(recordRepo.findOne).not.toHaveBeenCalled();
    expect(recordRepo.save).not.toHaveBeenCalled();
  });

  it('should resolve an already bound external identity', async () => {
    const member = asMember('m-2', 'bob');
    const binding = { memberId: 'm-2', channel: 'ldap', channelIdentifier: 'guid-1' } as MemberOAuthRecordEntity;
    const { gateway, recordRepo } = buildGateway({ seedMembers: [member], seedBindings: [binding] });

    const result = await gateway.resolve(directoryIdentity());

    expect(result.member.id).toBe('m-2');
    expect(recordRepo.save).not.toHaveBeenCalled();
  });

  it('should throw when a binding points at a member that no longer exists', async () => {
    const binding = { memberId: 'ghost', channel: 'ldap', channelIdentifier: 'guid-1' } as MemberOAuthRecordEntity;
    const { gateway } = buildGateway({ seedBindings: [binding] });

    await expect(gateway.resolve(directoryIdentity())).rejects.toBeInstanceOf(ExternalIdentityNotLinkedError);
  });
});

describe('AuthenticationGateway account linking', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should take over a matching local account and warn when linking is enabled', async () => {
    const member = asMember('m-3', 'guid-1');
    const { gateway, recordRepo } = buildGateway({ seedMembers: [member], linkExistingAccount: true });

    const result = await gateway.resolve(directoryIdentity());

    expect(result.member.id).toBe('m-3');
    expect(recordRepo.save).toHaveBeenCalledWith({
      memberId: 'm-3',
      channel: 'ldap',
      channelIdentifier: 'guid-1',
    });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('External identity linked to existing account'));
  });

  it('should refuse to link an unverified identifier under verified-only', async () => {
    const member = asMember('m-4', 'guid-1');
    const { gateway, registerWithoutPassword } = buildGateway({
      seedMembers: [member],
      linkExistingAccount: 'verified-only',
    });

    const result = await gateway.resolve(directoryIdentity({ identifierVerified: false }));

    // Falls through to provisioning rather than claiming the existing account.
    expect(registerWithoutPassword).toHaveBeenCalled();
    expect(result.member.id).toBe('provisioned-guid-1');
  });

  it('should link a verified identifier under verified-only', async () => {
    const member = asMember('m-5', 'guid-1');
    const { gateway } = buildGateway({ seedMembers: [member], linkExistingAccount: 'verified-only' });

    const result = await gateway.resolve(directoryIdentity({ identifierVerified: true }));

    expect(result.member.id).toBe('m-5');
  });

  it('should never link when linking is disabled', async () => {
    const member = asMember('m-6', 'guid-1');
    const { gateway, registerWithoutPassword } = buildGateway({
      seedMembers: [member],
      linkExistingAccount: false,
    });

    const result = await gateway.resolve(directoryIdentity({ identifierVerified: true }));

    expect(registerWithoutPassword).toHaveBeenCalled();
    expect(result.member.id).toBe('provisioned-guid-1');
  });

  it('should warn on boot while linking is enabled', () => {
    const { gateway } = buildGateway({ linkExistingAccount: true });

    gateway.onApplicationBootstrap();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('linkExistingAccount is enabled'));
  });

  it('should stay silent on boot when linking is disabled', () => {
    const { gateway } = buildGateway({ linkExistingAccount: false });

    gateway.onApplicationBootstrap();

    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('AuthenticationGateway provisioning', () => {
  it('should provision a passwordless member by default and bind the identity', async () => {
    const { gateway, recordRepo, registerWithoutPassword } = buildGateway();

    const result = await gateway.resolve(directoryIdentity());

    expect(registerWithoutPassword).toHaveBeenCalledWith('guid-1', { shouldUpdatePassword: false });
    expect(result.member.id).toBe('provisioned-guid-1');
    expect(recordRepo.save).toHaveBeenCalledWith({
      memberId: 'provisioned-guid-1',
      channel: 'ldap',
      channelIdentifier: 'guid-1',
    });
  });

  it('should reject unknown identities when auto provisioning is off', async () => {
    const { gateway } = buildGateway({ autoProvision: false });

    await expect(gateway.resolve(directoryIdentity())).rejects.toBeInstanceOf(ExternalIdentityNotLinkedError);
  });

  it('should delegate to a custom provisioning strategy', async () => {
    const member = asMember('approved', 'approved-account');
    const strategy = jest.fn(async (identity: AuthenticatedIdentity) =>
      (identity.attributes?.groups as string[] | undefined)?.includes('ALLOWED') ? 'approved' : null,
    );

    const { gateway, recordRepo } = buildGateway({
      autoProvision: strategy,
      seedMembers: [member],
    });

    const result = await gateway.resolve(directoryIdentity({ attributes: { groups: ['ALLOWED'] } }));

    expect(result.member.id).toBe('approved');
    expect(recordRepo.save).toHaveBeenCalledWith({
      memberId: 'approved',
      channel: 'ldap',
      channelIdentifier: 'guid-1',
    });
  });

  it('should reject when the custom strategy declines', async () => {
    const strategy = jest.fn(async () => null);
    const { gateway } = buildGateway({ autoProvision: strategy });

    await expect(gateway.resolve(directoryIdentity({ attributes: { groups: [] } }))).rejects.toBeInstanceOf(
      ExternalIdentityNotLinkedError,
    );
  });

  it('should reject when the custom strategy returns an unknown member id', async () => {
    const strategy = jest.fn(async () => 'does-not-exist');
    const { gateway } = buildGateway({ autoProvision: strategy });

    await expect(gateway.resolve(directoryIdentity())).rejects.toBeInstanceOf(ExternalIdentityNotLinkedError);
  });
});

describe('AuthenticationGateway login', () => {
  it('should authenticate through a provider and issue a token pair', async () => {
    const provider: AuthenticationProvider = {
      channel: PASSWORD_CHANNEL,
      kind: 'credential',
      authenticate: async (): Promise<AuthenticatedIdentity> => ({
        channel: PASSWORD_CHANNEL,
        identifier: 'alice',
        memberId: 'm-7',
      }),
    };

    const { gateway } = buildGateway({ providers: [provider], seedMembers: [asMember('m-7', 'alice')] });

    const pair = await gateway.login(PASSWORD_CHANNEL, { account: 'alice', password: 'x' });

    expect(pair.accessToken).toBe('access-m-7');
    expect(pair.refreshToken).toBe('refresh-m-7');
  });
});
