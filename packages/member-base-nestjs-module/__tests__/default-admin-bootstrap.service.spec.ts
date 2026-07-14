import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Enforcer } from 'casbin';
import { DefaultAdminBootstrapService } from '../src/services/default-admin-bootstrap.service';
import { MemberBaseService } from '../src/services/member-base.service';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { DEFAULT_CASBIN_DOMAIN } from '../src/constants/default-casbin-domain';
import { SUPER_ADMIN_ROLE } from '../src/constants/super-admin-role';
import { PasswordDoesNotMeetPolicyError } from '../src/constants/errors/base.error';

const MEMBER_ID = '00000000-0000-0000-0000-000000000020';

type Mocks = {
  baseMemberRepo: Repository<BaseMemberEntity>;
  findOne: jest.Mock;
  enforcer: Enforcer | null;
  addGroupingPolicy: jest.Mock;
  register: jest.Mock;
  generateValidPassword: jest.Mock;
  validatePassword: jest.Mock;
};

const buildService = (
  account: string | null,
  password: string | null,
  opts: {
    existing?: BaseMemberEntity | null;
    withEnforcer?: boolean;
    registerImpl?: jest.Mock;
    validatePasswordImpl?: jest.Mock;
  } = {},
): { service: DefaultAdminBootstrapService; mocks: Mocks } => {
  const findOne = jest.fn(async () => opts.existing ?? null);
  const baseMemberRepo = { findOne } as unknown as Repository<BaseMemberEntity>;

  const addGroupingPolicy = jest.fn(async () => true);
  const enforcer = opts.withEnforcer === false ? null : ({ addGroupingPolicy } as unknown as Enforcer);

  const register =
    opts.registerImpl ??
    jest.fn(async (acc: string) => {
      const member = new BaseMemberEntity();

      member.id = MEMBER_ID;
      member.account = acc;

      return member;
    });

  const generateValidPassword = jest.fn(() => 'Gener4tedPass');
  const validatePassword = opts.validatePasswordImpl ?? jest.fn(async () => true);

  const memberBaseService = { register } as unknown as MemberBaseService;
  const passwordValidatorService = {
    generateValidPassword,
    validatePassword,
  } as unknown as PasswordValidatorService;

  const service = new DefaultAdminBootstrapService(
    account,
    password,
    baseMemberRepo,
    enforcer,
    memberBaseService,
    passwordValidatorService,
  );

  return {
    service,
    mocks: { baseMemberRepo, findOne, enforcer, addGroupingPolicy, register, generateValidPassword, validatePassword },
  };
};

describe('DefaultAdminBootstrapService', () => {
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is a no-op when no defaultAdminAccount is configured', async () => {
    const { service, mocks } = buildService(null, null);

    await service.onApplicationBootstrap();

    expect(mocks.findOne).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it('generates a compliant password, creates the account, logs the password once, and grants super-admin', async () => {
    const { service, mocks } = buildService('root', null);

    await service.onApplicationBootstrap();

    expect(mocks.generateValidPassword).toHaveBeenCalled();
    expect(mocks.register).toHaveBeenCalledWith('root', 'Gener4tedPass');
    expect(mocks.addGroupingPolicy).toHaveBeenCalledWith(MEMBER_ID, SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN);

    const passwordLogs = warnSpy.mock.calls.filter(([msg]) => typeof msg === 'string' && msg.includes('Gener4tedPass'));

    expect(passwordLogs).toHaveLength(1);
  });

  it('uses a supplied valid password without logging it, and grants super-admin', async () => {
    const { service, mocks } = buildService('root', 'Suppli3dPass');

    await service.onApplicationBootstrap();

    expect(mocks.generateValidPassword).not.toHaveBeenCalled();
    expect(mocks.register).toHaveBeenCalledWith('root', 'Suppli3dPass');
    expect(mocks.addGroupingPolicy).toHaveBeenCalledWith(MEMBER_ID, SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN);

    const passwordLogs = warnSpy.mock.calls.filter(([msg]) => typeof msg === 'string' && msg.includes('Suppli3dPass'));

    expect(passwordLogs).toHaveLength(0);
  });

  it('propagates PasswordDoesNotMeetPolicyError when a supplied password is non-compliant', async () => {
    const registerImpl = jest.fn(async () => {
      throw new PasswordDoesNotMeetPolicyError();
    });

    const { service, mocks } = buildService('root', 'weak', { registerImpl });

    await expect(service.onApplicationBootstrap()).rejects.toBeInstanceOf(PasswordDoesNotMeetPolicyError);
    expect(mocks.addGroupingPolicy).not.toHaveBeenCalled();
  });

  it('skips creation when the account already exists', async () => {
    const existing = new BaseMemberEntity();

    existing.id = MEMBER_ID;
    existing.account = 'root';

    const { service, mocks } = buildService('root', 'Suppli3dPass', { existing });

    await service.onApplicationBootstrap();

    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.addGroupingPolicy).not.toHaveBeenCalled();
  });

  it('creates the account but warns and skips the grant when Casbin is not configured', async () => {
    const { service, mocks } = buildService('root', 'Suppli3dPass', { withEnforcer: false });

    await service.onApplicationBootstrap();

    expect(mocks.register).toHaveBeenCalledWith('root', 'Suppli3dPass');

    const skipWarns = warnSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('Casbin is not configured'),
    );

    expect(skipWarns).toHaveLength(1);
    // No success ("created with super-admin") log and no error on this path.
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
