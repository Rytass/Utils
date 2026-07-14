import { Logger } from '@nestjs/common';
import { Enforcer, newEnforcer, newModelFromString } from 'casbin';
import { Repository } from 'typeorm';
import { DefaultAdminBootstrapService } from '../src/services/default-admin-bootstrap.service';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { MemberBaseService } from '../src/services/member-base.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { MemberPasswordHistoryEntity } from '../src/models/member-password-history.entity';
import { createDefaultPermissionChecker } from '../src/constants/default-permission-checker';
import { CASBIN_MODEL } from '../src/constants/casbin-models/rbac-with-domains';
import { DEFAULT_CASBIN_DOMAIN } from '../src/constants/default-casbin-domain';
import { SUPER_ADMIN_ROLE } from '../src/constants/super-admin-role';

const ADMIN_ID = '00000000-0000-0000-0000-0000000000aa';
const OTHER_ID = '00000000-0000-0000-0000-0000000000bb';

// Real (in-memory) Casbin enforcer using the shipped RBAC-with-domains model.
const createRealEnforcer = (): Promise<Enforcer> => newEnforcer(newModelFromString(CASBIN_MODEL));

// Real password validator under the default policy (uppercase + lowercase + digit,
// min length 8, no history/age checks -> no DB access).
const createRealPasswordValidator = (): PasswordValidatorService =>
  new PasswordValidatorService(
    true,
    true,
    true,
    false,
    8,
    undefined,
    undefined,
    {} as unknown as Repository<MemberPasswordHistoryEntity>,
    undefined,
  );

describe('DefaultAdminBootstrapService — integration with real Casbin', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('grants a real super-admin grouping and the real default checker then allows the admin for ANY action', async () => {
    const enforcer = await createRealEnforcer();
    const passwordValidator = createRealPasswordValidator();

    // A non-admin member with a single concrete policy (to prove normal enforcement still works).
    await enforcer.addPolicy(OTHER_ID, DEFAULT_CASBIN_DOMAIN, 'doc', 'read');

    let registeredPassword: string | null = null;
    const memberBaseService = {
      register: jest.fn(async (account: string, password: string) => {
        registeredPassword = password;

        const member = new BaseMemberEntity();

        member.id = ADMIN_ID;
        member.account = account;

        return member;
      }),
    } as unknown as MemberBaseService;

    const baseMemberRepo = { findOne: jest.fn(async () => null) } as unknown as Repository<BaseMemberEntity>;

    const service = new DefaultAdminBootstrapService(
      'root',
      null, // no password -> generate a compliant one
      baseMemberRepo,
      enforcer,
      memberBaseService,
      passwordValidator,
    );

    await service.onApplicationBootstrap();

    // The generated password really satisfies the real policy validator.
    expect(registeredPassword).not.toBeNull();
    expect(await passwordValidator.validatePassword(registeredPassword as unknown as string)).toBe(true);

    // The grouping policy was really written to the enforcer.
    expect(await enforcer.hasGroupingPolicy(ADMIN_ID, SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN)).toBe(true);

    const checker = createDefaultPermissionChecker();

    // Admin is allowed for an action that has NO matching policy (allow-all).
    await expect(checker({ enforcer, payload: { id: ADMIN_ID }, actions: [['anything', 'whatever']] })).resolves.toBe(
      true,
    );

    // Non-admin is denied that same un-policied action...
    await expect(checker({ enforcer, payload: { id: OTHER_ID }, actions: [['anything', 'whatever']] })).resolves.toBe(
      false,
    );

    // ...but still allowed for the concrete policy it holds (normal path intact).
    await expect(checker({ enforcer, payload: { id: OTHER_ID }, actions: [['doc', 'read']] })).resolves.toBe(true);
  });

  it('is idempotent: an already-existing admin account is left untouched (no grant written)', async () => {
    const enforcer = await createRealEnforcer();

    const existing = new BaseMemberEntity();

    existing.id = ADMIN_ID;
    existing.account = 'root';

    const register = jest.fn();
    const memberBaseService = { register } as unknown as MemberBaseService;
    const baseMemberRepo = { findOne: jest.fn(async () => existing) } as unknown as Repository<BaseMemberEntity>;

    const service = new DefaultAdminBootstrapService(
      'root',
      'Str0ngPass',
      baseMemberRepo,
      enforcer,
      memberBaseService,
      createRealPasswordValidator(),
    );

    await service.onApplicationBootstrap();

    expect(register).not.toHaveBeenCalled();
    expect(await enforcer.hasGroupingPolicy(ADMIN_ID, SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN)).toBe(false);
  });
});
