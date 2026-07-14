import { Enforcer } from 'casbin';
import { createDefaultPermissionChecker } from '../src/constants/default-permission-checker';
import { DEFAULT_CASBIN_DOMAIN } from '../src/constants/default-casbin-domain';
import { SUPER_ADMIN_ROLE } from '../src/constants/super-admin-role';
import type { CasbinAuthorizationDecision } from '../src/typings/casbin-permission';

type EnforcerMock = {
  hasGroupingPolicy: jest.Mock;
  enforce: jest.Mock;
};

const createEnforcer = (overrides: Partial<EnforcerMock> = {}): { enforcer: Enforcer; mock: EnforcerMock } => {
  const mock: EnforcerMock = {
    hasGroupingPolicy: jest.fn(async () => false),
    enforce: jest.fn(async () => false),
    ...overrides,
  };

  return { enforcer: mock as unknown as Enforcer, mock };
};

const MEMBER_ID = '00000000-0000-0000-0000-000000000010';

describe('createDefaultPermissionChecker (no domainResolver)', () => {
  it('short-circuit-allows a super-admin member even when enforce would deny', async () => {
    const { enforcer, mock } = createEnforcer({
      hasGroupingPolicy: jest.fn(async () => true),
      enforce: jest.fn(async () => false),
    });

    const checker = createDefaultPermissionChecker();

    const result = await checker({
      enforcer,
      payload: { id: MEMBER_ID },
      actions: [['article', 'create']],
    });

    expect(result).toBe(true);
    expect(mock.hasGroupingPolicy).toHaveBeenCalledWith(MEMBER_ID, SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN);
    expect(mock.enforce).not.toHaveBeenCalled();
  });

  it('falls through to enforce for a non-super-admin and allows if ANY action passes', async () => {
    const { enforcer } = createEnforcer({
      enforce: jest.fn(async (_sub: string, _dom: string, obj: string) => obj === 'article'),
    });

    const checker = createDefaultPermissionChecker();

    const result = await checker({
      enforcer,
      payload: { id: MEMBER_ID },
      actions: [
        ['comment', 'create'],
        ['article', 'create'],
      ],
    });

    expect(result).toBe(true);
  });

  it('denies a non-super-admin when no action passes', async () => {
    const { enforcer } = createEnforcer({ enforce: jest.fn(async () => false) });

    const checker = createDefaultPermissionChecker();

    const result = await checker({
      enforcer,
      payload: { id: MEMBER_ID },
      actions: [['article', 'create']],
    });

    expect(result).toBe(false);
  });
});

describe('createDefaultPermissionChecker (with domainResolver)', () => {
  it('short-circuit-allows a super-admin without consulting the resolver', async () => {
    const { enforcer } = createEnforcer({ hasGroupingPolicy: jest.fn(async () => true) });
    const domainResolver = jest.fn(async () => ['tenant-a']);

    const checker = createDefaultPermissionChecker(domainResolver);

    const result = (await checker({
      enforcer,
      payload: { id: MEMBER_ID },
      actions: [['article', 'create']],
    })) as CasbinAuthorizationDecision;

    expect(result).toEqual({ allowed: true, matchedDomain: DEFAULT_CASBIN_DOMAIN });
    expect(domainResolver).not.toHaveBeenCalled();
  });

  it('resolves domains and returns the matched domain/action for a normal member', async () => {
    const { enforcer } = createEnforcer({
      enforce: jest.fn(async (_sub: string, dom: string) => dom === 'tenant-b'),
    });

    const domainResolver = jest.fn(async () => ['tenant-a', 'tenant-b']);

    const checker = createDefaultPermissionChecker(domainResolver);

    const result = (await checker({
      enforcer,
      payload: { id: MEMBER_ID },
      actions: [['article', 'create']],
    })) as CasbinAuthorizationDecision;

    expect(result).toEqual({
      allowed: true,
      matchedDomain: 'tenant-b',
      matchedAction: ['article', 'create'],
    });
  });

  it('denies when the resolver returns no domains', async () => {
    const { enforcer } = createEnforcer();
    const domainResolver = jest.fn(async () => []);

    const checker = createDefaultPermissionChecker(domainResolver);

    const result = (await checker({
      enforcer,
      payload: { id: MEMBER_ID },
      actions: [['article', 'create']],
    })) as CasbinAuthorizationDecision;

    expect(result).toEqual({ allowed: false });
  });
});
