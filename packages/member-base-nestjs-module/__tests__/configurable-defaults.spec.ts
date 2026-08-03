import { OptionProviders } from '../src/constants/option-providers';
import {
  DEFAULT_CASBIN_DOMAIN_NAME,
  LOGIN_LOG_ENABLED,
  LOGIN_LOG_RECORD_IP,
  PASSWORD_HASH_OPTIONS,
  SUPER_ADMIN_ROLE_NAME,
} from '../src/typings/member-base.tokens';
import { SUPER_ADMIN_ROLE } from '../src/constants/super-admin-role';
import { DEFAULT_CASBIN_DOMAIN } from '../src/constants/default-casbin-domain';
import { createDefaultPermissionChecker } from '../src/constants/default-permission-checker';
import { toInetCidr } from '../src/utils/to-inet-cidr';
import type { MemberBaseModuleOptionsDTO } from '../src/typings/member-base-module-options.dto';
import type { Enforcer } from 'casbin';
import type { CasbinPermissionCheckerParams } from '../src/typings/casbin-permission';

type FactoryProvider = { provide: symbol; useFactory: (...args: never[]) => unknown };

const resolve = (token: symbol, options?: MemberBaseModuleOptionsDTO): unknown => {
  const provider = (OptionProviders as FactoryProvider[]).find(candidate => candidate.provide === token);

  if (!provider) throw new Error('No provider registered for the token');

  return provider.useFactory(options as never);
};

/**
 * Every new option has to keep behaving exactly as before when it is not set —
 * that is the whole contract of adding one to a released package.
 */
describe('configurable defaults', () => {
  describe('when nothing is configured', () => {
    it.each([
      ['password hash options', PASSWORD_HASH_OPTIONS, {}],
      ['super admin role', SUPER_ADMIN_ROLE_NAME, SUPER_ADMIN_ROLE],
      ['default casbin domain', DEFAULT_CASBIN_DOMAIN_NAME, DEFAULT_CASBIN_DOMAIN],
      ['login log', LOGIN_LOG_ENABLED, true],
      ['login log ip', LOGIN_LOG_RECORD_IP, true],
    ])('should resolve %s to its documented default', (_label, token, expected) => {
      expect(resolve(token as symbol)).toEqual(expected);
    });

    it('should resolve the same defaults for an empty options object', () => {
      expect(resolve(SUPER_ADMIN_ROLE_NAME, {})).toBe(SUPER_ADMIN_ROLE);
      expect(resolve(LOGIN_LOG_ENABLED, {})).toBe(true);
    });
  });

  describe('when configured', () => {
    it('should pass argon2 cost parameters through untouched', () => {
      const passwordHashOptions = { memoryCost: 65536, timeCost: 3, parallelism: 4 };

      expect(resolve(PASSWORD_HASH_OPTIONS, { passwordHashOptions })).toEqual(passwordHashOptions);
    });

    it('should take the casbin names over the well-known constants', () => {
      const options = { superAdminRole: 'root', defaultCasbinDomain: 'global' };

      expect(resolve(SUPER_ADMIN_ROLE_NAME, options)).toBe('root');
      expect(resolve(DEFAULT_CASBIN_DOMAIN_NAME, options)).toBe('global');
    });

    it('should allow the login log to be turned off', () => {
      expect(resolve(LOGIN_LOG_ENABLED, { loginLogEnabled: false })).toBe(false);
      expect(resolve(LOGIN_LOG_RECORD_IP, { loginLogRecordIp: false })).toBe(false);
    });
  });

  describe('permission checker naming', () => {
    const buildEnforcer = (
      grouping: [string, string, string],
    ): { enforcer: Enforcer; hasGroupingPolicy: jest.Mock } => {
      const hasGroupingPolicy = jest.fn(
        async (id: string, role: string, domain: string) =>
          id === grouping[0] && role === grouping[1] && domain === grouping[2],
      );

      return { enforcer: { hasGroupingPolicy, enforce: jest.fn(async () => false) } as never, hasGroupingPolicy };
    };

    const params = (enforcer: Enforcer): CasbinPermissionCheckerParams =>
      ({ enforcer, payload: { id: 'admin' }, actions: [['doc', 'read']] }) as CasbinPermissionCheckerParams;

    it('should short-circuit on the well-known role by default', async () => {
      const { enforcer } = buildEnforcer(['admin', SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN]);

      await expect(createDefaultPermissionChecker()(params(enforcer))).resolves.toBe(true);
    });

    it('should short-circuit on a renamed role instead', async () => {
      const { enforcer } = buildEnforcer(['admin', 'root', 'global']);
      const checker = createDefaultPermissionChecker(undefined, { superAdminRole: 'root', defaultDomain: 'global' });

      await expect(checker(params(enforcer))).resolves.toBe(true);
    });

    it('should not honour the old name once it has been renamed', async () => {
      const { enforcer } = buildEnforcer(['admin', SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN]);
      const checker = createDefaultPermissionChecker(undefined, { superAdminRole: 'root', defaultDomain: 'global' });

      await expect(checker(params(enforcer))).resolves.toBe(false);
    });
  });

  describe('toInetCidr', () => {
    it.each([
      ['10.0.0.1', '10.0.0.1/32'],
      ['2001:db8::1', '2001:db8::1/128'],
      ['::1', '::1/128'],
    ])('should give %s the prefix length of its family', (ip, expected) => {
      expect(toInetCidr(ip)).toBe(expected);
    });
  });
});
